"use client";

import { TextField, type TextFieldProps } from "@/components/ui/field";

import { decimalOnly, digitsOnly } from "./digits";
import { MONEY_MAX, PERCENT_MAX } from "./limits";
import { moneyProblem, percentProblem } from "./validate";

/**
 * The two boxes an amount is typed into, with their unit, their column width and their pattern
 * check bound together — the affix, the placeholder, the decimal keypad, the contract's
 * `maxLength`, the matching `*Problem` check and the `decimalOnly` filter, in one place rather
 * than repeated at each of the six fields that take an amount.
 *
 * `onValueChange` rather than `onChange`: the filter is the point, so no caller should be able
 * to read the raw event and forget it.
 */
type AmountFieldProps = Omit<
  TextFieldProps,
  "prefix" | "suffix" | "inputMode" | "maxLength" | "error" | "onChange" | "value"
> & {
  value: string;
  /** The typed value with everything but digits and points already stripped. */
  onValueChange: (value: string) => void;
};

interface BoundProps extends AmountFieldProps {
  affix: { prefix: string } | { suffix: string };
  limit: number;
  problem: (value: string) => string | undefined;
}

function AmountField({ affix, limit, problem, value, onValueChange, ...props }: BoundProps) {
  return (
    <TextField
      {...affix}
      placeholder="0.00"
      inputMode="decimal"
      maxLength={limit}
      value={value}
      error={problem(value)}
      onChange={(e) => onValueChange(decimalOnly(e.target.value))}
      {...props}
    />
  );
}

export function MoneyField(props: AmountFieldProps) {
  return <AmountField affix={{ prefix: "$" }} limit={MONEY_MAX} problem={moneyProblem} {...props} />;
}

/** Placeholder differs — `0.00` reads as money where a `%` is expected. */
export function PercentField(props: AmountFieldProps) {
  return (
    <AmountField
      affix={{ suffix: "%" }}
      limit={PERCENT_MAX}
      problem={percentProblem}
      placeholder="15"
      {...props}
    />
  );
}

/**
 * A whole number: a count of days, a number of appointments, a distance in miles.
 *
 * Not an amount — no affix, no decimal point, and nothing here checks a pattern — but bound the
 * same way and for the same reason. `digitsOnly` is the guarantee, and `onValueChange` is what
 * stops a caller reading the raw event and forgetting it: a letter that reaches the wire is a
 * 400 about the whole step, raised on a screen the wizard has already moved off.
 *
 * A ceiling, a floor or a `maxLength` stays at the call site — those differ per field, and this
 * binds only what does not.
 */
type CountFieldProps = Omit<TextFieldProps, "inputMode" | "onChange" | "value"> & {
  value: string;
  /** The typed value with everything but digits already stripped. */
  onValueChange: (value: string) => void;
};

export function CountField({ value, onValueChange, ...props }: CountFieldProps) {
  return (
    <TextField
      inputMode="numeric"
      value={value}
      onChange={(e) => onValueChange(digitsOnly(e.target.value))}
      {...props}
    />
  );
}
