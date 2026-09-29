package com.tradeties.job;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One request with the terms frozen onto it, and the business as it is called today — the same
 * summary whichever side is reading it.
 *
 * @param status the wire's spelling of it; the two enums agree name for name
 * @param businessSlug empty when the business is gone, which a request outliving its business is
 *        allowed to do
 */
public record RequestSummary(
		UUID id,
		String status,
		String businessSlug,
		String businessName,
		String serviceName,
		int estimatedDurationMinutes,
		Instant startsAt,
		Instant endsAt,
		String timeZone,
		String currency,
		BigDecimal cancellationFee,
		int cancellationNoticeHours) {
}
