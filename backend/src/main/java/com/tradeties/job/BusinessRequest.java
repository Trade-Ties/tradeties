package com.tradeties.job;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One request as the business sees it, which is wider than what the customer gets back.
 *
 * <p>It carries their name, their telephone number and the address the work is at. That is what a
 * tradesperson needs to do the job and what nobody else has any business reading, so it travels
 * only under {@code /me/business}.
 *
 * <p>The money and the duration are the snapshot, not today's profile. What the customer agreed
 * to is what the tradesperson is deciding on.
 *
 * @param preferredContact null when the customer did not say, which is neither answer
 * @param declineReason present exactly when the request was declined
 */
public record BusinessRequest(
		UUID id,
		RequestState status,
		Instant startsAt,
		Instant endsAt,
		String timeZone,
		String serviceName,
		int estimatedDurationMinutes,
		String customerName,
		String customerEmail,
		String customerPhone,
		ContactMethod preferredContact,
		String description,
		String street1,
		String street2,
		String city,
		String state,
		String postalCode,
		String currency,
		BigDecimal servicePrice,
		BigDecimal effectiveHourlyRate,
		BigDecimal serviceCallFee,
		BigDecimal cancellationFee,
		int cancellationNoticeHours,
		Instant requestedAt,
		Instant decidedAt,
		String declineReason) {
}
