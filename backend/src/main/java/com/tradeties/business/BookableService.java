package com.tradeties.business;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One service of one published business, with every term a request has to freeze onto itself.
 *
 * <p><strong>Everything here is read once and copied, never referenced.</strong> What was shown
 * to the customer is what binds, so a business that raises its cancellation fee tomorrow must not
 * make today's request more expensive. The ids answer "what was meant"; these values answer "what
 * was agreed", and they stop agreeing the moment the profile is edited — which is the point.
 *
 * <p>A record rather than a handful of lookups, because the terms have to come from one read. The
 * fee, the rate and the duration taken separately could each be from a different version of the
 * profile if an edit landed between them.
 *
 * @param timeZone the business's own zone, which is also what the job records: a site's own zone
 *        cannot be derived from a postal code today
 * @param effectiveHourlyRate the rate that actually applies — the service's own when an hourly
 *        service overrides the general one, otherwise the business's. Resolved here so that
 *        billing never has to work out afterwards which of the two it was
 */
public record BookableService(
		UUID businessId,
		String businessSlug,
		String businessName,
		String timeZone,
		UUID serviceId,
		UUID tradeId,
		String serviceName,
		int estimatedDurationMinutes,
		ServicePricingMode pricingMode,
		BigDecimal price,
		BigDecimal hourlyRate,
		BigDecimal effectiveHourlyRate,
		BigDecimal serviceCallFee,
		BigDecimal cancellationFee,
		int cancellationNoticeHours,
		String currency) {
}
