// Shared by every marketing/customer-facing page (landing, /browse, …) so
// the footer only needs maintaining in one place.
export function SiteFooter() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5 px-6 text-sm text-faint">
        <span>© 2026 TradeTies</span>
        <nav className="flex flex-wrap gap-6">
          {["About us", "Help centre", "How it works", "For professionals", "Terms", "Privacy"].map((l) => (
            <a key={l} href="#" className="no-underline hover:text-brand">
              {l}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
