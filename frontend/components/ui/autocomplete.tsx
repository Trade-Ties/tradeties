"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import {
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_LIST_CLASS,
  DROPDOWN_LIST_MAX_HEIGHT,
  DROPDOWN_POPUP_CLASS,
  DROPDOWN_POPUP_WIDTH,
  DROPDOWN_ROW_HEIGHT,
} from "@/components/ui/dropdown-list";
import { inputClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A select whose list is narrowed by typing.
 *
 * Built on the kit's combobox rather than its autocomplete: only the combobox remembers a
 * selection apart from the text, and a state is stored as `CA` while it reads "California".
 *
 * Free text is not an answer here. The list is the whole set of answers, and what the box holds
 * while it is open is a query — on close the kit puts the selected label back.
 */

const Autocomplete = ComboboxPrimitive.Root;
const useAutocompleteFilter = ComboboxPrimitive.useFilter;

function AutocompleteInputGroup({
  className,
  ...props
}: ComboboxPrimitive.InputGroup.Props) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="autocomplete-input-group"
      className={cn("relative", className)}
      {...props}
    />
  );
}

function AutocompleteInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="autocomplete-input"
      className={cn(inputClassName, "pr-8", className)}
      {...props}
    />
  );
}

/**
 * `Combobox.Trigger` is a button, and a second tab stop on a field that already opens its list
 * on click and on the first arrow key buys nothing.
 */
function AutocompleteIcon({ className, ...props }: ComboboxPrimitive.Icon.Props) {
  return (
    <ComboboxPrimitive.Icon
      data-slot="autocomplete-icon"
      className={cn(
        "pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </ComboboxPrimitive.Icon>
  );
}

type AutocompleteContentProps = ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "align" | "side" | "sideOffset">;

function AutocompleteContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  ...props
}: AutocompleteContentProps) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        collisionAvoidance={{ side: "none", align: "shift" }}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="autocomplete-content"
          className={cn(DROPDOWN_POPUP_WIDTH, DROPDOWN_POPUP_CLASS, className)}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function AutocompleteList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="autocomplete-list"
      className={cn(
        DROPDOWN_LIST_MAX_HEIGHT,
        DROPDOWN_LIST_CLASS,
        "outline-none data-empty:p-0",
        className
      )}
      {...props}
    />
  );
}

function AutocompleteItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="autocomplete-item"
      className={cn(DROPDOWN_ROW_HEIGHT, DROPDOWN_ITEM_CLASS, "pr-8 pl-2.5", className)}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

/**
 * The padding is on the child rather than here: the kit keeps this element mounted so it can
 * announce the change, and only its children come and go. Padded itself, it would leave a
 * blank strip above every list that does have matches.
 */
function AutocompleteEmpty({
  className,
  children,
  ...props
}: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty data-slot="autocomplete-empty" {...props}>
      <div className={cn("px-2.5 py-3 text-sm text-muted-foreground", className)}>
        {children}
      </div>
    </ComboboxPrimitive.Empty>
  );
}

export {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteIcon,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
  useAutocompleteFilter,
};
