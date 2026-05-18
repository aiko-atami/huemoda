import { Switch } from "@base-ui/react/switch";
import { css } from "styled-system/css";

type ToggleProps = {
  disabled?: boolean;
  label: string;
  onPressedChange: (pressed: boolean) => void;
  pressed: boolean;
};

const rootClass = css({
  position: "relative",
  display: "inline-block",
  width: "36px",
  height: "22px",
  flex: "0 0 auto",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "full",
  background: "surface.highest",
  cursor: "pointer",
  transition: "background-color 160ms ease, border-color 160ms ease",
  _dataChecked: {
    background: "primary",
    borderColor: "primary",
  },
  _dataDisabled: {
    cursor: "not-allowed",
    opacity: "0.44",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "primary",
    outlineOffset: "2px",
  },
});

const thumbClass = css({
  position: "absolute",
  top: "3px",
  left: "3px",
  width: "14px",
  height: "14px",
  borderRadius: "full",
  background: "text.muted",
  transition: "background-color 160ms ease, transform 160ms ease",
  _groupDataChecked: {
    transform: "translateX(14px)",
    background: "primary.on",
  },
});

export function Toggle({ disabled = false, label, onPressedChange, pressed }: ToggleProps) {
  return (
    <Switch.Root
      className={rootClass}
      checked={pressed}
      onCheckedChange={onPressedChange}
      disabled={disabled}
      aria-label={label}
    >
      <Switch.Thumb className={thumbClass} />
    </Switch.Root>
  );
}
