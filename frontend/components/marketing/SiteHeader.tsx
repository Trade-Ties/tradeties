"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-5 px-6">
        <Link href="/" className="no-underline">
          <Logo />
        </Link>

        <nav className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            render={<Link href="#how" />}
            nativeButton={false}
            className="hidden h-auto rounded-full px-3.5 py-2 text-[14.5px] font-medium text-muted-ink hover:bg-brand-50 hover:text-brand min-[1040px]:inline-flex"
          >
            How it works
          </Button>

          <span aria-hidden="true" className="mx-2.5 hidden h-[22px] w-px bg-line min-[1040px]:block" />

          <Button
            render={<Link href="/portal" />}
            nativeButton={false}
            className="h-auto whitespace-nowrap rounded-full px-[19px] py-2.5 text-[14.5px] font-semibold"
          >
            For professionals
          </Button>

          <Button
            variant="outline"
            size="icon"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 size-9 rounded-[10px] border-line min-[1040px]:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </nav>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-white pb-[18px] pt-2.5 min-[1040px]:hidden">
          <div className="mx-auto max-w-[1180px] px-6">
            {[
              { label: "How it works", href: "#how" },
              { label: "Help", href: "#" },
            ].map(({ label, href }) => (
              <Button
                key={label}
                variant="ghost"
                render={<a href={href} />}
                nativeButton={false}
                onClick={() => setMobileOpen(false)}
                className="h-auto w-full justify-start rounded-none border-b border-line px-1 py-3 text-base font-medium text-brand hover:bg-transparent"
              >
                {label}
              </Button>
            ))}
            <Button
              render={<Link href="/portal" />}
            nativeButton={false}
              className="mt-4 h-auto w-full rounded-full py-[11px] text-[14.5px] font-semibold"
            >
              For professionals
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
