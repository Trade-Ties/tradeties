package com.tradeties.business;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * @param catalogId the marketplace job this service answers, or null for one typed by hand that
 *        fits no catalogue entry. Null is an ordinary state and not an incomplete one — but it
 *        costs something invisible from here, because a customer who picks a job from the search
 *        box is answered with the businesses linked to it
 * @param sortOrder position in the list, changed only through the reorder operation
 */
public record ServiceDetails(
		UUID id,
		UUID tradeId,
		UUID catalogId,
		String name,
		String description,
		int estimatedDurationMinutes,
		ServicePricingMode pricingMode,
		BigDecimal price,
		boolean active,
		int sortOrder,
		long version) {
}
