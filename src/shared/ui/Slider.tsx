import type { CSSProperties } from "react";

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
  const percent = ((value - min) / (max - min)) * 100;
  const style = {
    "--slider-fill": `${Math.min(Math.max(percent, 0), 100)}%`,
  } as CSSProperties;

  return (
    <label className="slider-control" style={style}>
      <span className="slider-control__header">
        <span>{label}</span>
        <output>{valueLabel}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
    </label>
  );
}
