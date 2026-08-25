package com.tradeties.business;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * No {@code sortOrder}: position is not something a single entry decides. A new service is
 * appended, and reordering is its own operation over the whole list.
 *
 * @param tradeId                  required, and a trade the business actually holds — checked
 *                                 by the service and guaranteed by a composite foreign key.
 *                                 A service sits under exactly one trade; giving the trade up
 *                                 takes the service with it
 * @param estimatedDurationMinutes reserved calendar time, which is not the time billed
 * @param price                    required for {@code FLAT} and {@code STARTING_AT},
 *                                 forbidden for {@code QUOTE_ONLY}, optional for
 *                                 {@code HOURLY}
 */
public record ServiceDefinition(
		UUID tradeId,
		String name,
		String description,
		int estimatedDurationMinutes,
		ServicePricingMode pricingMode,
		BigDecimal price,
		boolean active) {
}
