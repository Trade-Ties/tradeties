import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "Full calendar →" in the corner of a dashboard card: the way from its preview to the whole page. */
export function CardHeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "h-auto gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-50"
      )}
    >
      {children}
      <ArrowRight className="size-3" />
    </Link>
  );
}
