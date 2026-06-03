import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadedImage } from "../../../entities/image";
import { PixiPhotoRenderer } from "../../../shared/lib/pixi/PixiPhotoRenderer";
import type { PixiFilterValues } from "../../../shared/lib/pixi/filterTypes";

type PixiCanvasProps = {
  image: LoadedImage | null;
  filterValues: PixiFilterValues;
  onRendererReady: (renderer: PixiPhotoRenderer | null) => void;
};

type PointerPos = { x: number; y: number };

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MAX_MOVE = 24;

export function PixiCanvas({ image, filterValues, onRendererReady }: PixiCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PixiPhotoRenderer | null>(null);
  // Active pointers keyed by pointerId — drives single-pointer pan and
  // two-pointer pinch-zoom + pan. lastPosRef tracks the pan reference point
  // (single pointer position, or the midpoint of two pointers).
  const pointersRef = useRef<Map<number, PointerPos>>(new Map());
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastPinchDistRef = useRef(0);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return undefined;
    }

    const renderer = new PixiPhotoRenderer(host);
    let isMounted = true;

    rendererRef.current = renderer;

    void renderer
      .ready()
      .then(() => {
        if (isMounted) {
          onRendererReady(renderer);
        }
      })
      .catch(() => {
        if (isMounted) {
          onRendererReady(null);
        }
      });

    return () => {
      isMounted = false;
      onRendererReady(null);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [onRendererReady]);

  useEffect(() => {
    void rendererRef.current?.setImage(image?.objectUrl ?? null);
  }, [image?.objectUrl]);

  useEffect(() => {
    rendererRef.current?.setFilterValues(filterValues);
  }, [filterValues]);

  // Wheel zoom — нужен non-passive listener чтобы вызвать preventDefault
  const handleWheel = useCallback((e: WheelEvent) => {
    const renderer = rendererRef.current;
    const host = hostRef.current;

    if (renderer === null || host === null) {
      return;
    }

    e.preventDefault();

    const rect = host.getBoundingClientRect();

    renderer.wheelZoom(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return undefined;
    }

    host.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      host.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Reference point for pan: the single pointer, or the midpoint of two pointers.
  const syncPanReference = useCallback(() => {
    const pointers = [...pointersRef.current.values()];

    if (pointers.length === 1) {
      lastPosRef.current = { x: pointers[0].x, y: pointers[0].y };
    } else if (pointers.length >= 2) {
      const [a, b] = pointers;

      lastPosRef.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      lastPinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (image === null) {
        return;
      }

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setDragging(true);
      syncPanReference();
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [image, syncPanReference],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;

    if (!pointers.has(e.pointerId)) {
      return;
    }

    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const renderer = rendererRef.current;
    const host = hostRef.current;

    if (renderer === null || host === null) {
      return;
    }

    const active = [...pointers.values()];
    const rect = host.getBoundingClientRect();

    if (active.length >= 2) {
      // Two-pointer: pinch-zoom around the midpoint + pan by midpoint delta.
      const [a, b] = active;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);

      renderer.pan(midX - lastPosRef.current.x, midY - lastPosRef.current.y);

      if (lastPinchDistRef.current > 0 && dist > 0) {
        renderer.zoomAt(dist / lastPinchDistRef.current, midX - rect.left, midY - rect.top);
      }

      lastPosRef.current = { x: midX, y: midY };
      lastPinchDistRef.current = dist;
      return;
    }

    // Single pointer: pan.
    renderer.pan(e.clientX - lastPosRef.current.x, e.clientY - lastPosRef.current.y);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const pointers = pointersRef.current;
      const wasSingle = pointers.size === 1;
      const x = e.clientX;
      const y = e.clientY;

      pointers.delete(e.pointerId);

      if (pointers.size === 0) {
        setDragging(false);
      }

      // Re-anchor the pan reference when going from two pointers back to one.
      syncPanReference();

      // pointercancel means the gesture was interrupted (e.g. the browser took
      // over) — its coordinates aren't a deliberate tap, so skip double-tap.
      if (e.type === "pointercancel") {
        return;
      }

      // Touch double-tap → reset view (mouse uses onDoubleClick).
      if (wasSingle && e.pointerType !== "mouse") {
        const now = e.timeStamp;
        const last = lastTapRef.current;
        const moved = Math.hypot(x - last.x, y - last.y);

        if (now - last.time < DOUBLE_TAP_MS && moved < DOUBLE_TAP_MAX_MOVE) {
          rendererRef.current?.resetView();
          lastTapRef.current = { time: 0, x: 0, y: 0 };
        } else {
          lastTapRef.current = { time: now, x, y };
        }
      }
    },
    [syncPanReference],
  );

  const handleDoubleClick = useCallback(() => {
    rendererRef.current?.resetView();
  }, []);

  const cursor = image === null ? undefined : dragging ? "grabbing" : "grab";

  return (
    <div
      className="canvas-stage__pixi"
      ref={hostRef}
      style={cursor !== undefined ? { cursor, touchAction: "none" } : { touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    />
  );
}
