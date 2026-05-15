type ToggleProps = {
  disabled?: boolean;
  label: string;
  onPressedChange: () => void;
  pressed: boolean;
};

export function Toggle({ disabled = false, label, onPressedChange, pressed }: ToggleProps) {
  return (
    <button
      type="button"
      className={["toggle", pressed ? "is-pressed" : ""].filter(Boolean).join(" ")}
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onPressedChange}
    >
      <span aria-hidden="true" />
    </button>
  );
}
