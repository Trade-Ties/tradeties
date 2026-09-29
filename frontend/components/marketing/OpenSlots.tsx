import { cookies } from "next/headers";

import { AvailabilityRail } from "@/components/marketing/AvailabilityRail";
import { INVALID_SELECTION } from "@/lib/api/failure";
import { searchBusinesses } from "@/lib/api/marketplace";
import { isZip, ZIP_COOKIE } from "@/lib/zip-memory";

/**
 * The landing page's open slots, searched for on the server near the ZIP the visitor last gave.
 *
 * With none remembered there is nothing to search: the section asks for one instead of guessing,
 * since the marketplace is not tied to one region and any fixed default would be somebody else's
 * neighbourhood. The search is the same one the hero bar runs, with no job — everybody who reaches
 * that ZIP, nearest first — and only the businesses with a time to offer make it onto the rail.
 */
export async function OpenSlots() {
  const zip = (await cookies()).get(ZIP_COOKIE)?.value;
  if (!isZip(zip)) {
    return <AvailabilityRail zip={null} state={{ kind: "ask" }} />;
  }

  const found = await searchBusinesses(zip, null, null, null);
  if (!found.ok) {
    return (
      <AvailabilityRail
        zip={zip}
        state={{ kind: found.failure.type === INVALID_SELECTION ? "unknown-zip" : "failed" }}
      />
    );
  }

  const open = (found.data.results ?? []).filter((result) => (result.nextSlots ?? []).length > 0);
  return <AvailabilityRail zip={zip} state={{ kind: "found", results: open }} />;
}
