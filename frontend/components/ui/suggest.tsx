"use client";

import { Autocomplete as SuggestPrimitive } from "@base-ui/react/autocomplete";

import { DROPDOWN_ITEM_CLASS, DROPDOWN_ROW_HEIGHT } from "@/components/ui/dropdown-list";
import { cn } from "@/lib/utils";

/**
 * A text box that offers answers without insisting on them.
 *
 * The other half of `Autocomplete`: there the list is the whole set of answers and what is typed
 * is only a query; here the typed text is the value and the list is a shortcut. A license type
 * is the case — "Master Plumber" for most, and some trade board issues one nobody catalogued.
 *
 * Built on the kit's autocomplete rather than its combobox for that reason: the combobox keeps
 * a selection apart from the text, and this control has no selection to keep.
 *
 * Only the root and the item live here. Every other part is the same component the combobox
 * uses, reused from there so the two controls cannot drift apart.
 */

const Suggest = SuggestPrimitive.Root;

function SuggestItem({ className, children, ...props }: SuggestPrimitive.Item.Props) {
  return (
    <SuggestPrimitive.Item
      data-slot="suggest-item"
      className={cn(DROPDOWN_ROW_HEIGHT, DROPDOWN_ITEM_CLASS, "px-2.5", className)}
      {...props}
    >
      {children}
    </SuggestPrimitive.Item>
  );
}

export { Suggest, SuggestItem };
