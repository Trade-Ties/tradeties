import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleRowProps
  extends Omit<React.ComponentProps<"div">, "title" | "children" | "onToggle"> {
  /** Ties the header button to the panel it opens. Must be unique on the page. */
  panelId: string;
  open: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  titleMuted?: boolean;
  problem?: string | null;
  /** Read-only summary at the right-hand end. Dropped below `sm`, where there is no room. */
  summary?: React.ReactNode;
  /** Sits before the chevron, outside the button — a drag handle, say. */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  panelClassName?: string;
  children: React.ReactNode;
}

export function CollapsibleRow({
  panelId,
  open,
  onToggle,
  title,
  titleMuted,
  problem,
  summary,
  leading,
  actions,
  panelClassName,
  className,
  children,
  ...props
}: CollapsibleRowProps) {
  return (
    <div className={cn("rounded-lg border bg-background", className)} {...props}>
      <div className="flex h-11 items-center gap-1 pr-2 pl-3">
        {leading}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
          <span className={cn("truncate font-medium", titleMuted && "text-muted-foreground")}>
            {title}
          </span>

          {problem && (
            <Badge variant="destructive" className="shrink-0">
              {problem}
            </Badge>
          )}

          {summary && (
            <span className="ml-auto hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
              {summary}
            </span>
          )}
        </button>

        {actions}
      </div>

      {open && (
        <div id={panelId} className={cn("border-t", panelClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

interface EmptyListProps {
  children: React.ReactNode;
}

export function EmptyList({ children }: EmptyListProps) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
