package com.tradeties.business;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * @param verifiedAt when TradeTies confirmed this exact combination of state, number and
 *                   type. {@code null} means unverified — which is every licence today,
 *                   because the verification flow does not exist yet
 */
public record LicenseDetails(
		UUID id,
		String state,
		String licenseNumber,
		String licenseType,
		LocalDate issuedOn,
		LocalDate expiresOn,
		Instant verifiedAt,
		long version) {
}
