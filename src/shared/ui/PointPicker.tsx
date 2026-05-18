import {
  useCallback,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { css } from "styled-system/css";

type PointPickerProps = {
  disabled?: boolean;
  label: string;
  onValueChange: (x: number, y: number) => void;
  x: number;
  y: number;
};

const containerClass = css({
  display: "grid",
  gap: "8px",
  color: "text.muted",
});

const headerClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  fontSize: "12px",
  fontWeight: "700",
});

const labelClass = css({
  color: "text.muted",
});

const valueClass = css({
  minWidth: "60px",
  color: "secondary",
  fontSize: "12px",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
});

const padDisabledClass = css({
  cursor: "not-allowed",
  opacity: "0.44",
});

const padClass = css({
  position: "relative",
  width: "100%",
  height: "120px",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "DEFAULT",
  background:
    "linear-gradient(rgba(120, 113, 148, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120, 113, 148, 0.08) 1px, transparent 1px), var(--surface-high)",
  backgroundSize: "25% 25%",
  cursor: "crosshair",
  outline: "none",
  touchAction: "none",
  userSelect: "none",
  // center guidelines
  "&::before, &::after": {
    content: "''",
    position: "absolute",
    pointerEvents: "none",
    background: "rgba(120, 113, 148, 0.22)",
  },
  "&::before": {
    top: "50%",
    left: "0",
    width: "100%",
    height: "1px",
  },
  "&::after": {
    top: "0",
    left: "50%",
    width: "1px",
    height: "100%",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "primary",
    outlineOffset: "2px",
  },
});

const crosshairClass = css({
  position: "absolute",
  top: "var(--pp-y)",
  left: "var(--pp-x)",
  width: "12px",
  height: "12px",
  border: "2px solid",
  borderColor: "surface",
  borderRadius: "full",
  background: "primary",
  boxShadow: "0 0 0 1px var(--primary)",
  pointerEvents: "none",
  transform: "translate(-50%, -50%)",
});

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
    <div className={containerClass} aria-disabled={disabled || undefined}>
      <div className={headerClass}>
        <span id={labelId} className={labelClass}>
          {label}
        </span>
        <output htmlFor={labelId} className={valueClass}>
          {Math.round(x)}% · {Math.round(y)}%
        </output>
      </div>
      <div
        ref={padRef}
        role="group"
        aria-labelledby={labelId}
        aria-label={`${label}: ${Math.round(x)}% horizontal, ${Math.round(y)}% vertical. Use arrow keys to move, hold Shift for larger steps.`}
        tabIndex={disabled ? -1 : 0}
        className={disabled ? `${padClass} ${padDisabledClass}` : padClass}
        style={style}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
      >
        <div className={crosshairClass} aria-hidden="true" />
      </div>
    </div>
  );
}
