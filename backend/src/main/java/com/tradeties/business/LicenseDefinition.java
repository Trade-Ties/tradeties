package com.tradeties.business;

import java.time.LocalDate;

/**
 * One licence, as the tradesperson enters it in onboarding step 6.
 *
 * <p>No {@code verifiedAt}: the mark is TradeTies' statement, not the holder's, and a client
 * that could set it would be certifying itself.
 *
 * @param state       where the licence is valid. Licensing is per state, and a tradesperson near
 *                    a state line legally works in two
 * @param licenseType free text with suggestions — the names differ by state, so a fixed list
 *                    would be wrong somewhere
 */
public record LicenseDefinition(
		String state,
		String licenseNumber,
		String licenseType,
		LocalDate issuedOn,
		LocalDate expiresOn) {
}
