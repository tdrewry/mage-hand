import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumericInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number;
  onChange: (value: number) => void;
  /** Value to commit when the field is left empty (default: 0) */
  fallback?: number;
  /** Allow float values instead of integers */
  float?: boolean;
}

/**
 * A numeric input that allows the field to be emptied during editing.
 * The numeric value is committed on blur or Enter.
 */
const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, fallback = 0, float = false, className, min, max, onKeyDown, ...props }, ref) => {
    const [localValue, setLocalValue] = React.useState(String(value));
    const [focused, setFocused] = React.useState(false);

    // Sync from props when not focused
    React.useEffect(() => {
      if (!focused) {
        setLocalValue(String(value));
      }
    }, [value, focused]);

    const commit = (raw: string) => {
      const parsed = float ? parseFloat(raw) : parseInt(raw, 10);
      let final = isNaN(parsed) ? fallback : parsed;
      if (min !== undefined) final = Math.max(Number(min), final);
      if (max !== undefined) final = Math.min(Number(max), final);
      onChange(final);
      setLocalValue(String(final));
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={float ? "decimal" : "numeric"}
        className={cn(className)}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit(localValue);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(localValue);
            (e.target as HTMLInputElement).blur();
          }
          onKeyDown?.(e);
        }}
        min={min}
        max={max}
        {...props}
      />
    );
  }
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
export type { NumericInputProps };
