"use client";

import { useId } from "react";
import { BadgeCheck } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * The "Licensed only" switch, shared by the browse page and the search results so the two filter
 * panels ask it the same way. Licensed means a licence is on file — the same thing the card's
 * badge says, and no more.
 */
export function LicensedOnly({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <label htmlFor={id} className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold text-brand">
        <BadgeCheck className="size-4 shrink-0 text-go" aria-hidden="true" />
        Licensed only
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
