package com.tradeties.business;

import java.util.List;

/**
 * The trades a business holds, resolved to full catalogue entries so the caller does not
 * have to join against the catalogue itself.
 *
 * @param primary    the one trade the business is found under first. {@code null} only for a
 *                   draft that has not been through onboarding step 3 — the database allows
 *                   *at most* one primary trade, and no primary at all is a legal draft
 * @param additional everything else it offers, never containing the primary again
 */
public record TradeSelection(TradeOption primary, List<TradeOption> additional) {

	public TradeSelection {
		additional = additional == null ? List.of() : List.copyOf(additional);
	}
}
