// Small pill toggle shared across the filter UIs (/browse's Rating and
// Availability sections, the search-results page's time-of-day row) —
// click the active one again to clear it, matching how booking sites
// usually let a single-select filter row also mean "no preference."
export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-brand px-2.5 py-1.5 text-[13px] font-semibold text-white"
          : "rounded-full border border-line bg-white px-2.5 py-1.5 text-[13px] font-medium text-muted-ink transition-colors hover:border-brand-100 hover:bg-brand-50 hover:text-brand"
      }
    >
      {children}
    </button>
  );
}
