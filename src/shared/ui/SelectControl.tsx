import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { css } from "styled-system/css";

type SelectOption = {
  label: string;
  value: string;
};

type SelectControlProps = {
  "aria-label"?: string;
  disabled?: boolean;
  label?: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  triggerClassName?: string;
  value: string;
};

const rootClass = css({
  display: "grid",
  gap: "8px",
  color: "text.muted",
});

const labelClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  fontSize: "12px",
  fontWeight: "700",
});

const triggerClass = css({
  display: "grid",
  width: "100%",
  minHeight: "34px",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "8px",
  padding: "6px 8px 6px 10px",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "DEFAULT",
  background: "surface.high",
  color: "text",
  cursor: "pointer",
  textAlign: "left",
  transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
  _hover: {
    _enabled: {
      background: "surface.highest",
      borderColor: "outline.strong",
    },
  },
  _disabled: {
    cursor: "not-allowed",
    opacity: "0.48",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "primary",
    outlineOffset: "2px",
  },
  "& [data-placeholder]": {
    color: "text.dim",
  },
});

const iconClass = css({
  color: "text.dim",
});

const positionerClass = css({
  zIndex: 30,
});

const popupClass = css({
  minWidth: "var(--anchor-width)",
  maxHeight: "min(260px, var(--available-height))",
  overflow: "auto",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "DEFAULT",
  background: "surface.highest",
  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.28)",
});

const listClass = css({
  display: "grid",
  gap: "2px",
  padding: "4px",
});

const itemClass = css({
  display: "grid",
  minHeight: "30px",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "8px",
  padding: "5px 7px",
  borderRadius: "sm",
  color: "text.muted",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "700",
  outline: "0",
  _dataHighlighted: {
    background: "surface.bright",
    color: "text",
  },
  _dataSelected: {
    color: "secondary",
  },
});

const indicatorClass = css({
  display: "grid",
  placeItems: "center",
  color: "secondary",
});

export function SelectControl({
  "aria-label": ariaLabel,
  disabled = false,
  label,
  onValueChange,
  options,
  triggerClassName,
  value,
}: SelectControlProps) {
  return (
    <div className={rootClass}>
      <Select.Root
        aria-label={ariaLabel}
        disabled={disabled}
        items={options}
        value={value}
        onValueChange={(nextValue) => {
          if (typeof nextValue === "string") {
            onValueChange(nextValue);
          }
        }}
      >
        {label !== undefined ? <Select.Label className={labelClass}>{label}</Select.Label> : null}
        <Select.Trigger className={[triggerClass, triggerClassName].filter(Boolean).join(" ")}>
          <Select.Value />
          <Select.Icon className={iconClass}>
            <ChevronDown size={14} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className={positionerClass} sideOffset={6}>
            <Select.Popup className={popupClass}>
              <Select.List className={listClass}>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    className={itemClass}
                    value={option.value}
                    label={option.label}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className={indicatorClass}>
                      <Check size={13} aria-hidden="true" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
