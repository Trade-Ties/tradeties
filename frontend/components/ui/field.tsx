"use client";

import * as React from "react";

import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteIcon,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
  useAutocompleteFilter,
} from "@/components/ui/autocomplete";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Suggest, SuggestItem } from "@/components/ui/suggest";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * `aria-hidden` on purpose: the glyph is a convention for sighted readers, and screen readers
 * are told the same thing once — through `aria-required` on the control itself — instead of
 * reading out a star nobody asked about.
 */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

interface FieldProps {
  label: string;
  /** `TextField`/`TextareaField` fill this in themselves. */
  htmlFor?: string;
  /** Names the label for a control `htmlFor` cannot point at, such as a radio group. */
  labelId?: string;
  required?: boolean;
  hint?: string;
  /** Replaces the hint while set, and marks the control invalid. */
  error?: string;
  /**
   * Names the hint/error line, so the control can point at it with `aria-describedby`. Without
   * it `aria-invalid` announces "invalid entry" and the reason is never read out.
   */
  messageId?: string;
  /** Right-hand side of the label row, e.g. a character counter. */
  labelAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  labelId,
  required,
  hint,
  error,
  messageId,
  labelAction,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label id={labelId} htmlFor={htmlFor} className="gap-1">
          {label}
          {required && <RequiredMark />}
        </Label>
        {labelAction && (
          <span className="text-xs tabular-nums text-muted-foreground">{labelAction}</span>
        )}
      </div>
      {children}
      {error ? (
        <p id={messageId} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * `describedBy` is `undefined` when there is no line to describe — an id on no element is a
 * reference a screen reader resolves to nothing.
 */
export function useFieldIds(hasMessage: boolean) {
  const id = React.useId();

  return {
    controlId: id,
    labelId: `${id}-label`,
    messageId: `${id}-message`,
    describedBy: hasMessage ? `${id}-message` : undefined,
  };
}

/**
 * The kit's own default is `h-8`, and a select carries it as `data-[size=default]:h-8` — an
 * attribute selector, which outranks a plain `h-10` no matter the class order. So the override
 * has to be written in the same shape, and lives here rather than being retyped at each select.
 */
export const CONTROL_HEIGHT = "h-10 data-[size=default]:h-10";

interface OwnFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Classes for the field wrapper; `className` goes to the control. */
  fieldClassName?: string;
}

type Fielded<P> = P & OwnFieldProps;

/**
 * A hook rather than a `withField(Control)` wrapper because `SelectField` is generic in its
 * option type, and a higher-order component erases that.
 *
 * `aria-required` rather than the native attribute: the wizard validates and saves per step
 * through its own buttons, so a native `required` adds a second, browser-styled complaint on
 * top of the one the step already shows.
 */
function useFielded({ label, required, hint, error, fieldClassName }: OwnFieldProps) {
  const { controlId, messageId, describedBy } = useFieldIds(Boolean(error || hint));

  return {
    field: {
      label,
      htmlFor: controlId,
      messageId,
      required,
      hint,
      error,
      className: fieldClassName,
    },
    aria: {
      id: controlId,
      "aria-required": required || undefined,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : undefined,
    },
  } as const;
}

interface AffixProps {
  /** Unit shown at the left-hand end of the box, e.g. `$`. Never part of the value. */
  prefix?: string;
  /** Unit shown at the right-hand end, e.g. `%` or `mi`. Never part of the value. */
  suffix?: string;
}

type AffixInputProps = Omit<React.ComponentProps<"input">, "prefix"> & AffixProps;

/**
 * How much of the box an affix is given, indexed by its length. A table rather than a
 * short/long guess, so a four-letter unit does not overflow the room cut for a `%` and leave
 * the call site patching this control's spacing. Index 0 is unused; anything wider clamps to
 * the last entry.
 */
const PREFIX_ROOM = ["", "pl-7", "pl-9", "pl-11", "pl-14"] as const;
const SUFFIX_ROOM = ["", "pr-8", "pr-10", "pr-12", "pr-14"] as const;

const roomFor = (table: readonly string[], affix: string) =>
  table[Math.min(affix.length, table.length - 1)];

/**
 * The glyph is `pointer-events-none` so the strip it sits on still belongs to the input behind
 * it.
 */
function AffixInput({ prefix, suffix, className, ...props }: AffixInputProps) {
  const input = (
    <Input
      className={cn(
        CONTROL_HEIGHT,
        prefix && roomFor(PREFIX_ROOM, prefix),
        suffix && roomFor(SUFFIX_ROOM, suffix),
        className
      )}
      {...props}
    />
  );

  if (!prefix && !suffix) return input;

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      {input}
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

export type TextFieldProps = Fielded<
  Omit<React.ComponentProps<"input">, "id" | "prefix"> & AffixProps
> & {
    /**
     * For a status the field is given rather than one it can work out, such as whether a URL is
     * free.
     */
    labelAction?: React.ReactNode;
  };

export function TextField({
  label,
  hint,
  error,
  required,
  prefix,
  suffix,
  labelAction,
  fieldClassName,
  className,
  ...props
}: TextFieldProps) {
  const { field, aria } = useFielded({ label, required, hint, error, fieldClassName });

  return (
    <Field {...field} labelAction={labelAction}>
      <AffixInput prefix={prefix} suffix={suffix} className={className} {...aria} {...props} />
    </Field>
  );
}

export type TextareaFieldProps = Fielded<Omit<React.ComponentProps<"textarea">, "id">> & {
    /** Shows `used/maxLength` in the label row. Needs `maxLength`. */
    showCount?: boolean;
  };

export function TextareaField({
  label,
  hint,
  error,
  required,
  showCount,
  fieldClassName,
  className,
  value,
  maxLength,
  ...props
}: TextareaFieldProps) {
  const { field, aria } = useFielded({ label, required, hint, error, fieldClassName });
  const used = typeof value === "string" ? value.length : 0;

  return (
    <Field {...field} labelAction={showCount && maxLength ? `${used}/${maxLength}` : undefined}>
      <Textarea
        value={value}
        maxLength={maxLength}
        className={className}
        {...aria}
        {...props}
      />
    </Field>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  desc?: string;
}

const CHOICE_COLUMNS = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
} as const;

interface ChoiceFieldProps<T extends string> {
  label: string;
  required?: boolean;
  hint?: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  columns?: keyof typeof CHOICE_COLUMNS;
  className?: string;
}

export function ChoiceField<T extends string>({
  label,
  required,
  hint,
  options,
  value,
  onValueChange,
  columns = 1,
  className,
}: ChoiceFieldProps<T>) {
  const { controlId, labelId, messageId, describedBy } = useFieldIds(Boolean(hint));

  return (
    <Field
      label={label}
      labelId={labelId}
      messageId={messageId}
      required={required}
      hint={hint}
      className={className}
    >
      <RadioGroup
        // Named by the label rather than pointed at by it: `htmlFor` takes one control and a
        // radio group is several, so without this the group has no accessible name at all.
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        // On the group, which is what carries the question. Putting it on each radio would say
        // "required" of every individual option, which is the opposite of what it means here.
        aria-required={required || undefined}
        value={value}
        onValueChange={(next) => onValueChange((next ?? value) as T)}
        className={cn("gap-2 pt-1", CHOICE_COLUMNS[columns])}
      >
        {options.map((option) => {
          // Prefixed rather than the bare option value: `included` is a travel model *and* a
          // material model, and two tiles sharing an id point half the labels at the wrong radio.
          const id = `${controlId}-${option.value}`;

          return (
            <Label
              key={option.value}
              htmlFor={id}
              // `leading-tight` overrides the `leading-none` every `Label` carries: collapsed to
              // its cap height there is no room for the `desc` line under the title.
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-input px-3 py-2 leading-tight font-normal transition-colors hover:border-ring has-data-checked:border-primary has-data-checked:bg-primary/5"
            >
              <RadioGroupItem value={option.value} id={id} className="mt-px" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{option.label}</span>
                {option.desc && (
                  <span className="text-xs text-muted-foreground">{option.desc}</span>
                )}
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </Field>
  );
}

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: React.ReactNode;
}

export function toOptions<T extends string | number>(
  values: readonly T[],
  label: (value: T) => React.ReactNode
): SelectOption<T>[] {
  return values.map((value) => ({ value, label: label(value) }));
}

interface SelectControlProps<T extends string | number> {
  options: readonly SelectOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  placeholder?: string;
  /** Classes for the trigger. Defaults to the full width of its column. */
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  /** Lands on the trigger, so a `Field` label can point at it with `htmlFor`. */
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /**
   * Set by `SelectField` from its own `required`, and available to a caller drawing a bare
   * control inside a `Field` of its own. Not the native attribute — see `TextField`.
   */
  "aria-required"?: boolean;
}

/**
 * The kit takes and returns strings; this hands back the option's own type, so a step storing
 * minutes as a number is not left converting in both directions at every call site.
 */
export function SelectControl<T extends string | number>({
  options,
  value,
  onValueChange,
  placeholder,
  className,
  contentClassName,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: SelectControlProps<T>) {
  // Cut once per option list, not once per render of whatever holds the dropdown: the hours
  // step draws fourteen of these over ninety-seven quarter-hours each. Callers must pass a
  // stable array for this to hold.
  const renderedItems = React.useMemo(
    () =>
      options.map((option) => (
        <SelectItem key={String(option.value)} value={String(option.value)}>
          {option.label}
        </SelectItem>
      )),
    [options]
  );

  // The same options as data rather than elements. The rendered items above only fill the
  // popup; without this the kit cannot turn the selected value back into its label and
  // `<Select.Value>` shows the raw value — a trade UUID where its name belongs. Stringified to
  // match what `Select` is handed below.
  const items = React.useMemo(
    () => options.map((option) => ({ value: String(option.value), label: option.label })),
    [options]
  );

  return (
    <Select
      items={items}
      value={String(value)}
      disabled={disabled}
      onValueChange={(next) => {
        const picked = options.find((o) => String(o.value) === String(next));
        // Falls back to what is already there: the kit hands back `null` when a click lands
        // outside an item, and a step must not be told its answer changed to nothing.
        onValueChange(picked ? picked.value : value);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        className={cn(CONTROL_HEIGHT, "w-full", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {renderedItems}
      </SelectContent>
    </Select>
  );
}

/** `fieldClassName` goes to the field wrapper; `className` goes to the trigger. */
export type SelectFieldProps<T extends string | number> = Fielded<SelectControlProps<T>>;

export function SelectField<T extends string | number>({
  label,
  required,
  hint,
  error,
  fieldClassName,
  ...control
}: SelectFieldProps<T>) {
  const { field, aria } = useFielded({ label, required, hint, error, fieldClassName });

  return (
    <Field {...field}>
      <SelectControl {...aria} {...control} />
    </Field>
  );
}

export interface AutocompleteOption {
  value: string;
  /**
   * Plain text, unlike a `SelectOption`'s: it is not only what the row shows, it is what the
   * typed query is matched against and what the box reads once the list has closed.
   */
  label: string;
}

interface AutocompleteControlProps {
  /**
   * Every answer there is. Long enough to be worth filtering — that is the whole reason to
   * reach for this over `SelectControl` — and, like there, it must be a stable array.
   */
  options: readonly AutocompleteOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  /** Classes for the input. Defaults to the full width of its column. */
  className?: string;
  disabled?: boolean;
  /** Lands on the input, so a `Field` label can point at it with `htmlFor`. */
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/**
 * A dropdown you can type into, for lists too long to scroll — fifty states, ninety-odd time
 * zones.
 *
 * Takes and gives back the stored code — `CA`, `America/Denver` — and never the label, so a
 * caller swapping `SelectField` for this one changes nothing else. What is typed is a query and
 * is never stored: the kit puts the chosen label back in the box when the list closes.
 */
function AutocompleteControl({
  options,
  value,
  onValueChange,
  placeholder,
  emptyMessage = "No matches.",
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: AutocompleteControlProps) {
  // The kit holds the whole option, not the code: it needs the label to show and to match on.
  // `null` for a code the catalogue no longer has, which leaves the box empty rather than
  // printing a raw `America/Denver` where a name belongs.
  const selected = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  // `value` is what makes the list open whole again after a choice: without it the label
  // sitting in the box counts as a query and the list narrows to the one row already chosen.
  const { contains } = useAutocompleteFilter({ value: selected, sensitivity: "base" });

  const filter = React.useCallback(
    (option: AutocompleteOption, query: string) =>
      // The code as well as the label, which is the whole of it for a time zone: nothing in
      // "Mountain Time" says Denver, and `America/Denver` is what a tradesperson may well type.
      contains(option, query) || contains(option.value, query),
    [contains]
  );

  return (
    <Autocomplete<AutocompleteOption>
      items={options}
      value={selected}
      // Falls back to what is already there, as the select does: the kit hands back `null` when
      // a selection is dropped, and a step must not be told its answer changed to nothing.
      onValueChange={(next) => onValueChange(next ? next.value : value)}
      // The options are rebuilt from the catalogue on each render of the step that holds them,
      // so the selected one is a different object from the one in `items` — identity would
      // never match and no row would ever show a tick.
      isItemEqualToValue={(a, b) => a?.value === b?.value}
      filter={filter}
      // The top match is armed, so typing "cali" and pressing Enter picks California.
      autoHighlight
      disabled={disabled}
    >
      <AutocompleteInputGroup>
        <AutocompleteInput
          id={id}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          className={cn(CONTROL_HEIGHT, className)}
        />
        <AutocompleteIcon />
      </AutocompleteInputGroup>
      <AutocompleteContent>
        <AutocompleteEmpty>{emptyMessage}</AutocompleteEmpty>
        <AutocompleteList>
          {(option: AutocompleteOption) => (
            <AutocompleteItem key={option.value} value={option}>
              {option.label}
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  );
}

/** `fieldClassName` goes to the field wrapper; `className` goes to the input. */
export type AutocompleteFieldProps = Fielded<AutocompleteControlProps>;

export function AutocompleteField({
  label,
  required,
  hint,
  error,
  fieldClassName,
  ...control
}: AutocompleteFieldProps) {
  const { field, aria } = useFielded({ label, required, hint, error, fieldClassName });

  return (
    <Field {...field}>
      <AutocompleteControl {...aria} {...control} />
    </Field>
  );
}

interface SuggestControlProps {
  /**
   * Offered, never imposed. Unlike an `AutocompleteControl`'s options these are not the set of
   * answers — they are the common ones, and the box takes anything.
   */
  suggestions: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  /** Classes for the input. Defaults to the full width of its column. */
  className?: string;
  disabled?: boolean;
  /** Lands on the input, so a `Field` label can point at it with `htmlFor`. */
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/**
 * What `<input list>` and `<datalist>` do, in a control that can be styled. No CSS reaches the
 * native popup, so it sizes to its content rather than to the field, ignores the row height
 * every other dropdown keeps, and differs between browsers.
 */
function SuggestControl({
  suggestions,
  value,
  onValueChange,
  placeholder,
  maxLength,
  autoFocus,
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: SuggestControlProps) {
  return (
    <Suggest<string>
      items={suggestions}
      value={value}
      // No fallback to the current value, unlike the select and the autocomplete: emptying this
      // box is a real answer, because the answer was never confined to the list.
      onValueChange={(next) => onValueChange(next)}
      // The list is a shortcut, so it is shown as soon as the box is touched rather than only
      // once enough has been typed to narrow it — seven license types is a menu, not a search.
      openOnInputClick
      disabled={disabled}
    >
      <AutocompleteInputGroup>
        <AutocompleteInput
          id={id}
          placeholder={placeholder}
          maxLength={maxLength}
          // Puts the cursor in the box without opening the list: `openOnInputClick` above is
          // about a click, and a row that unfolds with a menu already hanging off it covers
          // the fields under it before the reader has looked at them.
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          className={cn(CONTROL_HEIGHT, className)}
        />
        <AutocompleteIcon />
      </AutocompleteInputGroup>
      {/* Nothing stands in for an empty list, and the popup goes away with it: an answer the
          suggestions do not have is the point of this control, not a dead end. */}
      <AutocompleteContent className="data-empty:hidden">
        <AutocompleteList>
          {(suggestion: string) => (
            <SuggestItem key={suggestion} value={suggestion}>
              {suggestion}
            </SuggestItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Suggest>
  );
}

/** `fieldClassName` goes to the field wrapper; `className` goes to the input. */
export type SuggestFieldProps = Fielded<SuggestControlProps>;

export function SuggestField({
  label,
  required,
  hint,
  error,
  fieldClassName,
  ...control
}: SuggestFieldProps) {
  const { field, aria } = useFielded({ label, required, hint, error, fieldClassName });

  return (
    <Field {...field}>
      <SuggestControl {...aria} {...control} />
    </Field>
  );
}

const FIELD_COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
} as const;

interface FieldGridProps {
  columns: keyof typeof FIELD_COLUMNS;
  className?: string;
  children: React.ReactNode;
}

export function FieldGrid({ columns, className, children }: FieldGridProps) {
  return (
    <div className={cn("grid gap-4", FIELD_COLUMNS[columns], className)}>{children}</div>
  );
}

interface CheckboxFieldProps {
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * `group/field` is what the box reads to go quiet with its label — a row that cannot be
 * ticked says so by dimming rather than by vanishing and taking its own explanation with it.
 */
export function CheckboxField({
  label,
  checked,
  onCheckedChange,
  disabled,
  className,
}: CheckboxFieldProps) {
  return (
    <label
      className={cn(
        "group/field flex items-center gap-2.5 text-sm",
        disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
        className
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      {label}
    </label>
  );
}

interface CheckboxGridProps {
  className?: string;
  /**
   * Id of the label naming the whole grid. Each box carries its own wording, but "HVAC,
   * checkbox" alone does not say what ticking it decides; given this, the grid becomes a named
   * group and the answer is announced with the question.
   */
  labelledBy?: string;
  children: React.ReactNode;
}

export function CheckboxGrid({ className, labelledBy, children }: CheckboxGridProps) {
  return (
    <div
      role={labelledBy ? "group" : undefined}
      aria-labelledby={labelledBy}
      className={cn("grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3", className)}
    >
      {children}
    </div>
  );
}
