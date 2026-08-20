package com.tradeties.business;

import java.math.BigDecimal;

/**
 * Not a history. This is the current configuration only — what applied yesterday lives
 * solely in the snapshot columns a request carries. A real price history would mean
 * immutable price versions that a request points at, which is the next step and not this one.
 */
public record PricingTerms(
		String currency,
		BigDecimal hourlyRate,
		int minimumBillableMinutes,
		int billingIncrementMinutes,
		BigDecimal serviceCallFee,
		boolean serviceCallFeeWaivedIfHired,
		TravelFeeMode travelFeeMode,
		BigDecimal travelFlatFee,
		BigDecimal travelRatePerMile,
		Integer freeTravelRadiusMiles,
		MaterialPricingMode materialPricingMode,
		BigDecimal materialMarkupPercent,
		BigDecimal cancellationFee,
		int cancellationNoticeHours,
		long version) {
}
