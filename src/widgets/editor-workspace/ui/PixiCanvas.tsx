import { useEffect, useRef } from "react";
import type { LoadedImage } from "../../../entities/image/model";
import { PixiPhotoRenderer } from "../../../shared/lib/pixi/PixiPhotoRenderer";
import type { PixiFilterValues } from "../../../shared/lib/pixi/filterTypes";

type PixiCanvasProps = {
  image: LoadedImage | null;
  filterValues: PixiFilterValues;
  onRendererReady: (renderer: PixiPhotoRenderer | null) => void;
};

export function PixiCanvas({ image, filterValues, onRendererReady }: PixiCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PixiPhotoRenderer | null>(null);

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

  return <div className="canvas-stage__pixi" ref={hostRef} />;
}
