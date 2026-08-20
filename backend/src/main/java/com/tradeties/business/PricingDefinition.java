package com.tradeties.business;

import java.math.BigDecimal;

/**
 * The rates and terms a tradesperson sets in onboarding step 5.
 *
 * <p>No currency: the marketplace is US-only, and the field exists on the stored side purely
 * so a later market does not have to change the shape.
 *
 * @param hourlyRate                  the general rate; a service priced {@code HOURLY} may
 *                                    override it with its own
 * @param serviceCallFeeWaivedIfHired only meaningful with a fee — waiving one that does not exist
 *                                    is not a statement
 * @param cancellationNoticeHours     hours, not "one day": 24 answers "may I still cancel" with a
 *                                    subtraction
 */
public record PricingDefinition(
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
		int cancellationNoticeHours) {
}
