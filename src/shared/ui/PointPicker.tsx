import {
  useCallback,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type PointPickerProps = {
  disabled?: boolean;
  label: string;
  onValueChange: (x: number, y: number) => void;
  x: number;
  y: number;
};

export function PointPicker({ disabled = false, label, onValueChange, x, y }: PointPickerProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const resolveCoords = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current;
      if (pad === null) return;
      const rect = pad.getBoundingClientRect();
      const nx = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100);
      const ny = Math.min(Math.max(((clientY - rect.top) / rect.height) * 100, 0), 100);
      onValueChange(Math.round(nx * 2) / 2, Math.round(ny * 2) / 2);
    },
    [onValueChange],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      resolveCoords(e.clientX, e.clientY);
    },
    [disabled, resolveCoords],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
      resolveCoords(e.clientX, e.clientY);
    },
    [disabled, resolveCoords],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const step = e.shiftKey ? 5 : 1;
      let nx = x;
      let ny = y;
      if (e.key === "ArrowLeft") nx = Math.max(0, x - step);
      else if (e.key === "ArrowRight") nx = Math.min(100, x + step);
      else if (e.key === "ArrowUp") ny = Math.max(0, y - step);
      else if (e.key === "ArrowDown") ny = Math.min(100, y + step);
      else return;
      e.preventDefault();
      onValueChange(nx, ny);
    },
    [disabled, x, y, onValueChange],
  );

  const style = {
    "--pp-x": `${x}%`,
    "--pp-y": `${y}%`,
  } as CSSProperties;

  return (
    <div className="point-picker" aria-disabled={disabled || undefined}>
      <div className="point-picker__header">
        <span id={labelId} className="point-picker__label">
          {label}
        </span>
        <output htmlFor={labelId} className="point-picker__value">
          {Math.round(x)}% · {Math.round(y)}%
        </output>
      </div>
      <div
        ref={padRef}
        role="group"
        aria-labelledby={labelId}
        aria-label={`${label}: ${Math.round(x)}% horizontal, ${Math.round(y)}% vertical. Use arrow keys to move, hold Shift for larger steps.`}
        tabIndex={disabled ? -1 : 0}
        className="point-picker__pad"
        style={style}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
      >
        <div className="point-picker__crosshair" aria-hidden="true" />
      </div>
    </div>
  );
}
