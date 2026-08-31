package com.tradeties.business;

import java.util.List;

/**
 * What a search found, and what it read the description as.
 *
 * <p>The two travel together because the second explains the first. Results narrowed to plumbing
 * make sense only alongside "this was read as plumbing" — and where the description named more
 * than one trade, that list is what lets a client ask the customer instead of choosing for them.
 *
 * <p>The results are one page of what matched, and the four numbers beside them are what makes
 * that page readable as part of a whole. Without them a short list is ambiguous in the worst way:
 * "that is everyone" and "that is the first two dozen" look identical.
 *
 * @param matchedTrades best first, at most three, and empty when the description named no trade
 *                      at all — including when there was no description. The results are then
 *                      everyone who reaches the postal code
 * @param results one page of them, {@code pageSize} long at most, ordered by distance and then
 *                slug. Empty on page 1 means nobody matched; empty later means past the end
 * @param page which page this is, counting from 1
 * @param pageSize the most a page carries. Server-side, never asked for
 * @param total how many matched, counted no further than the cap
 * @param totalCapped true when more exist than the cap counts, which is what turns {@code total}
 *                    from a figure into a floor — "240+" rather than "240"
 */
public record BusinessSearchResults(List<TradeMatch> matchedTrades, List<BusinessSearchResult> results,
		int page, int pageSize, int total, boolean totalCapped) {
}
