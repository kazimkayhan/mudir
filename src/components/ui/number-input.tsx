import type * as React from "react";

import { Input } from "@/components/ui/input";
import { parseNumberInput } from "@/lib/number-input";

type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  value: number;
  onValueChange: (value: number) => void;
};

function NumberInput({
  value,
  onValueChange,
  min = 0,
  ...props
}: NumberInputProps) {
  return (
    <Input
      dir="ltr"
      min={min}
      onChange={(e) => {
        onValueChange(parseNumberInput(e.target.value));
      }}
      type="number"
      value={value}
      {...props}
    />
  );
}

export { NumberInput };
