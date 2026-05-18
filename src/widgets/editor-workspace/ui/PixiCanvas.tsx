import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadedImage } from "../../../entities/image";
import { PixiPhotoRenderer } from "../../../shared/lib/pixi";
import type { PixiFilterValues } from "../../../shared/lib/pixi";

type PixiCanvasProps = {
  image: LoadedImage | null;
  filterValues: PixiFilterValues;
  onRendererReady: (renderer: PixiPhotoRenderer | null) => void;
};

export function PixiCanvas({ image, filterValues, onRendererReady }: PixiCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PixiPhotoRenderer | null>(null);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (image === null) {
        return;
      }

      isDraggingRef.current = true;
      setDragging(true);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [image],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
      return;
    }

    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;

    lastPosRef.current = { x: e.clientX, y: e.clientY };
    rendererRef.current?.pan(dx, dy);
  }, []);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    rendererRef.current?.resetView();
  }, []);

  const cursor = image === null ? undefined : dragging ? "grabbing" : "grab";

  return (
    <div
      className="canvas-stage__pixi"
      ref={hostRef}
      style={cursor !== undefined ? { cursor } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    />
  );
}
