import { useId, type CSSProperties } from "react";
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

export function Slider({
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
  const percent = ((value - min) / (max - min)) * 100;
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
        value={value}
        aria-valuetext={valueLabel}
        aria-describedby={outputId}
        disabled={disabled}
        className={inputClass}
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
    </label>
  );
}
