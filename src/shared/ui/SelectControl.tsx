import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

type SelectOption = {
  label: string;
  value: string;
};

type SelectControlProps = {
  disabled?: boolean;
  label: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  value: string;
};

export function SelectControl({
  disabled = false,
  label,
  onValueChange,
  options,
  value,
}: SelectControlProps) {
  return (
    <div className="select-control">
      <Select.Root
        disabled={disabled}
        items={options}
        value={value}
        onValueChange={(nextValue) => {
          if (typeof nextValue === "string") {
            onValueChange(nextValue);
          }
        }}
      >
        <Select.Label className="select-control__label">{label}</Select.Label>
        <Select.Trigger className="select-control__trigger">
          <Select.Value />
          <Select.Icon className="select-control__icon">
            <ChevronDown size={14} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className="select-control__positioner" sideOffset={6}>
            <Select.Popup className="select-control__popup">
              <Select.List className="select-control__list">
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    className="select-control__item"
                    value={option.value}
                    label={option.label}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="select-control__indicator">
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
