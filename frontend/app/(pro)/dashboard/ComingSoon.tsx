/**
 * The tag the portal puts on anything that is on its way but not working yet — the same one the
 * Notifications card in Settings carries, so "coming soon" looks one way everywhere.
 */
export function ComingSoonTag() {
  return (
    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-500">
      Coming soon
    </span>
  );
}

/**
 * A page for a feature that is not live yet: its title and what it will do, over an empty,
 * greyed-out outline of the page it will become. Empty rather than filled with made-up figures,
 * so nobody reads a sample as their own numbers, and out of reach of the pointer and screen
 * readers, so none of it passes for something that can be used.
 */
export function ComingSoonPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-brand">{title}</h1>
        <ComingSoonTag />
      </div>
      <p className="mb-8 max-w-prose text-muted-ink">{description}</p>

      <div aria-hidden="true" inert className="pointer-events-none select-none opacity-50 grayscale">
        {children}
      </div>
    </div>
  );
}

/** What an empty list inside the outline says, in place of rows. */
export function EmptyRows({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted-ink">
      {children}
    </p>
  );
}
