package com.tradeties.business;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * @param sortOrder position in the list, changed only through the reorder operation
 */
public record ServiceDetails(
		UUID id,
		UUID tradeId,
		String name,
		String description,
		int estimatedDurationMinutes,
		ServicePricingMode pricingMode,
		BigDecimal price,
		boolean active,
		int sortOrder,
		long version) {
}
