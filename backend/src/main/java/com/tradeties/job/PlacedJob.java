package com.tradeties.job;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A job and its first request, as they were just written.
 *
 * <p>Flat rather than nested, because every field here is read straight onto one response and
 * nothing downstream navigates between them.
 *
 * <p>{@code accessToken} is the clear value and travels no further than the response it is put
 * into. It exists in this record, in that JSON, and in whatever the customer keeps — never in the
 * database, which holds only its digest.
 *
 * @param timeZone the zone the appointment is read against: the business's own, which is also
 *        what the job recorded. See the migration for why it is not the site's
 */
public record PlacedJob(
		UUID jobId,
		String accessToken,
		Instant accessTokenExpiresAt,
		UUID requestId,
		String businessSlug,
		String businessName,
		String timeZone,
		String serviceName,
		int estimatedDurationMinutes,
		Instant startsAt,
		Instant endsAt,
		String currency,
		BigDecimal cancellationFee,
		int cancellationNoticeHours) {
}
