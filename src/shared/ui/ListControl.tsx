import { useId, useRef } from "react";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { Check } from "lucide-react";
import { css } from "styled-system/css";

type ListOption = {
  label: string;
  value: string;
};

type ListControlProps = {
  disabled?: boolean;
  label: string;
  onValueChange: (value: string) => void;
  options: readonly ListOption[];
  value: string;
};

const containerClass = css({
  display: "grid",
  gap: "2",
  color: "text.muted",
  fontSize: "xs",
  fontWeight: "bold",
});

const labelClass = css({
  display: "flex",
  alignItems: "center",
  fontSize: "xs",
  fontWeight: "bold",
});

const scrollRootClass = css({
  position: "relative",
  height: "196px",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "sm",
  background: "surface.high",
});

const scrollViewportClass = css({
  height: "100%",
  overflowY: "auto",
});

const scrollbarClass = css({
  position: "absolute",
  top: "0",
  bottom: "0",
  right: "2px",
  width: "4px",
  display: "flex",
  flexDirection: "column",
  padding: "2px 0",
});

const scrollThumbClass = css({
  flex: 1,
  borderRadius: "full",
  background: "outline.strong",
  opacity: 0.5,
  _hover: { opacity: 0.8 },
});

const radioGroupClass = css({
  display: "grid",
});

const itemClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "2",
  minHeight: "30px",
  padding: "5px 8px 5px 10px",
  cursor: "pointer",
  userSelect: "none",
  transitionProperty: "background, color",
  transitionDuration: "80ms",
  transitionTimingFunction: "ease",
  _hover: {
    background: "surface.bright",
    color: "text",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "primary",
    outlineOffset: "-2px",
  },
});

const radioRootClass = css({
  display: "contents",
});

const itemLabelClass = css({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "xs",
  fontWeight: "bold",
  color: "text.muted",
  _groupDataChecked: {
    color: "secondary",
  },
});

const indicatorClass = css({
  display: "none",
  flexShrink: 0,
  color: "secondary",
  _groupDataChecked: {
    display: "grid",
    placeItems: "center",
  },
});

export function ListControl({
  disabled = false,
  label,
  onValueChange,
  options,
  value,
}: ListControlProps) {
  const labelId = useId();
  const committedRef = useRef(value);

  return (
    <div className={containerClass} aria-disabled={disabled || undefined}>
      <span className={labelClass} id={labelId}>
        {label}
      </span>
      <ScrollArea.Root className={scrollRootClass}>
        <ScrollArea.Viewport className={scrollViewportClass}>
          <RadioGroup
            className={radioGroupClass}
            value={committedRef.current}
            disabled={disabled}
            aria-labelledby={labelId}
            onValueChange={(nextValue) => {
              if (typeof nextValue === "string") {
                committedRef.current = nextValue;
                onValueChange(nextValue);
              }
            }}
          >
            {options.map((option) => (
              <label
                key={option.value}
                className={itemClass}
                onMouseEnter={() => {
                  if (!disabled) onValueChange(option.value);
                }}
                onMouseLeave={() => {
                  if (!disabled) onValueChange(committedRef.current);
                }}
              >
                <Radio.Root value={option.value} className={radioRootClass}>
                  <span className={itemLabelClass}>{option.label}</span>
                  <Radio.Indicator keepMounted className={indicatorClass}>
                    <Check size={12} aria-hidden="true" />
                  </Radio.Indicator>
                </Radio.Root>
              </label>
            ))}
          </RadioGroup>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className={scrollbarClass}>
          <ScrollArea.Thumb className={scrollThumbClass} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
