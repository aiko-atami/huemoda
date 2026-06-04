import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { css } from "styled-system/css";

type SliderProps = {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  step: number;
  value: number;
  valueLabel: string;
};

const controlClass = css({
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

const outputClass = css({
  minWidth: "46px",
  color: "secondary",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
});

const inputClass = css({
  width: "100%",
  height: "18px",
  margin: "0",
  appearance: "none",
  background: "transparent",
  cursor: "pointer",
  _disabled: {
    cursor: "not-allowed",
    opacity: "0.44",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "primary",
    outlineOffset: "2px",
  },
  // WebKit track
  "&::-webkit-slider-runnable-track": {
    height: "3px",
    borderRadius: "9999px",
    background:
      "linear-gradient(90deg, var(--primary) 0 var(--slider-fill), var(--surface-highest) var(--slider-fill) 100%)",
  },
  // WebKit thumb
  "&::-webkit-slider-thumb": {
    width: "14px",
    height: "14px",
    marginTop: "-5.5px",
    appearance: "none",
    border: "2px solid",
    borderColor: "surface",
    borderRadius: "full",
    background: "primary",
  },
  // Firefox track
  "&::-moz-range-track": {
    height: "3px",
    borderRadius: "9999px",
    background: "var(--surface-highest)",
  },
  "&::-moz-range-progress": {
    height: "3px",
    borderRadius: "9999px",
    background: "primary",
  },
  // Firefox thumb
  "&::-moz-range-thumb": {
    width: "14px",
    height: "14px",
    border: "2px solid",
    borderColor: "surface",
    borderRadius: "full",
    background: "primary",
  },
});

function SliderComponent({
  disabled = false,
  label,
  max,
  min,
  onValueChange,
  step,
  value,
  valueLabel,
}: SliderProps) {
  const id = useId();
  const outputId = `${id}-value`;

  // The native input stays visually immediate on every event, but the store
  // dispatch is coalesced to one call per animation frame so a drag updates the
  // model at most once per frame. The exact final value is flushed on release.
  const [draftValue, setDraftValue] = useState(value);
  const isDraggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  // Keep the visible value in sync with the controlled prop while not dragging.
  useEffect(() => {
    if (!isDraggingRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  const flushPending = useCallback(() => {
    rafIdRef.current = null;

    if (pendingRef.current !== null) {
      const next = pendingRef.current;
      pendingRef.current = null;
      onValueChange(next);
    }
  }, [onValueChange]);

  const scheduleDispatch = useCallback(
    (next: number) => {
      pendingRef.current = next;

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushPending);
      }
    },
    [flushPending],
  );

  useEffect(
    () => () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    },
    [],
  );

  const beginInteraction = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const endInteraction = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;

    // Flush the latest value synchronously so the settled store value is exact.
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (pendingRef.current !== null) {
      const next = pendingRef.current;
      pendingRef.current = null;
      onValueChange(next);
    }
  }, [onValueChange]);

  const handleChange = useCallback(
    (next: number) => {
      setDraftValue(next);

      if (isDraggingRef.current) {
        scheduleDispatch(next);
      } else {
        // Keyboard step / programmatic — dispatch immediately.
        onValueChange(next);
      }
    },
    [onValueChange, scheduleDispatch],
  );

  const handlePointerDown = useCallback(() => {
    if (disabled) {
      return;
    }

    beginInteraction();
  }, [disabled, beginInteraction]);

  const handlePointerUp = useCallback(
    (_event: ReactPointerEvent<HTMLInputElement>) => {
      endInteraction();
    },
    [endInteraction],
  );

  const handleKeyDown = useCallback(() => {
    if (disabled) {
      return;
    }

    beginInteraction();
  }, [disabled, beginInteraction]);

  const handleKeyUp = useCallback(() => {
    endInteraction();
  }, [endInteraction]);

  const range = max - min;
  const percent = range === 0 ? 0 : ((draftValue - min) / range) * 100;
  const style = {
    "--slider-fill": `${Math.min(Math.max(percent, 0), 100)}%`,
  } as CSSProperties;

  return (
    <label className={controlClass} style={style}>
      <span className={headerClass}>
        <span>{label}</span>
        <output id={outputId} htmlFor={id} className={outputClass}>
          {valueLabel}
        </output>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        aria-valuetext={valueLabel}
        aria-describedby={outputId}
        disabled={disabled}
        className={inputClass}
        onChange={(event) => handleChange(Number(event.target.value))}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={endInteraction}
      />
    </label>
  );
}

export const Slider = memo(SliderComponent);
