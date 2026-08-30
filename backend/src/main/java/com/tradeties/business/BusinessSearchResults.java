package com.tradeties.business;

import java.util.List;

/**
 * What a search found, and what it read the description as.
 *
 * <p>The two travel together because the second explains the first. Results narrowed to plumbing
 * make sense only alongside "this was read as plumbing" — and where the description named more
 * than one trade, that list is what lets a client ask the customer instead of choosing for them.
 *
 * @param matchedTrades best first, at most three, and empty when the description named no trade
 *                      at all — including when there was no description. The results are then
 *                      everyone who reaches the postal code
 */
public record BusinessSearchResults(List<TradeMatch> matchedTrades, List<BusinessSearchResult> results) {
}
