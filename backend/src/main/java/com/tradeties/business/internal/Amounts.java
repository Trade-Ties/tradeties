package com.tradeties.business.internal;

import java.math.BigDecimal;

import com.tradeties.business.ImplausibleAmountException;
import com.tradeties.business.PricingDefinition;
import com.tradeties.business.ServiceDefinition;

/**
 * The ceilings that separate a price from a misplaced decimal point.
 *
 * <p>Not a statement about what is expensive. Each number sits in the gap between what a US trade
 * actually charges and what the same charge looks like typed with the point two places too far
 * right — an hourly rate reaches $800 for a specialist, while slipped rates land between $7,500
 * and $25,000, so $2,000 refuses every shifted rate above $20 an hour and accepts every real one.
 *
 * <p><strong>The two mistakes are not symmetric</strong>, which is why the gap is used and not the
 * tightest bound that would work. Refusing a real $800 rate is a signup abandoned in the middle of
 * onboarding; a typo that gets through is read by its own author on the next screen. Where the two
 * pull against each other the ceiling goes up.
 *
 * <p>Worth having because a request snapshots these amounts when it is sent (DATAMODEL,
 * {@code job_request}), after which a mistyped cancellation fee is an invoice somebody is expected
 * to pay.
 *
 * <p>USD, and that is an assumption rather than a constant. A second currency has to read these
 * beside {@code business_pricing.currency} instead of from here.
 *
 * <p>Nothing here overlaps with the contract: {@code MoneyAmount} bounds the <em>format</em>, and
 * a string schema has no per-field {@code maximum} to bound the magnitude with.
 */
final class Amounts {

	/** Typical $75–250, and $800 for a specialist. Shifted, those are $7,500–25,000. */
	static final BigDecimal MAX_HOURLY_RATE = new BigDecimal("2000");

	/** The "$89 service call". Typical $49–199, shifted $4,900–19,900. */
	static final BigDecimal MAX_SERVICE_CALL_FEE = new BigDecimal("2000");

	/** Typical $25–150, shifted $2,500–15,000. */
	static final BigDecimal MAX_TRAVEL_FLAT_FEE = new BigDecimal("1000");

	/**
	 * The tightest ceiling here, and the one that earns the most. Real rates live under $5 — the IRS
	 * mileage rate is $0.70 — and heavy haul does not reach $15. Slipping the point on $0.65 gives
	 * $65, which a looser bound would wave through precisely because the number still looks small.
	 */
	static final BigDecimal MAX_TRAVEL_RATE_PER_MILE = new BigDecimal("50");

	/** Typical $50–250, shifted $5,000–25,000. */
	static final BigDecimal MAX_CANCELLATION_FEE = new BigDecimal("2500");

	/**
	 * The one ceiling with no gap to sit in: a whole-house repipe is a real $30,000 flat price, and
	 * a $300 job typed wrong is $30,000 as well. Set above every real job instead, so it catches
	 * only the gross slip — $2,500 entered as $250,000 — which is the most this field can do.
	 */
	static final BigDecimal MAX_SERVICE_PRICE = new BigDecimal("250000");

	private Amounts() {
	}

	static void requirePlausible(PricingDefinition definition) {
		requireAtMost("An hourly rate", definition.hourlyRate(), MAX_HOURLY_RATE);
		requireAtMost("A service call fee", definition.serviceCallFee(), MAX_SERVICE_CALL_FEE);
		requireAtMost("A flat travel fee", definition.travelFlatFee(), MAX_TRAVEL_FLAT_FEE);
		requireAtMost("A travel rate per mile", definition.travelRatePerMile(), MAX_TRAVEL_RATE_PER_MILE);
		requireAtMost("A cancellation fee", definition.cancellationFee(), MAX_CANCELLATION_FEE);
	}

	static void requirePlausible(ServiceDefinition definition) {
		requireAtMost("A service price", definition.price(), MAX_SERVICE_PRICE);
	}

	/**
	 * Inclusive: the ceiling is a value somebody may still charge, not the first one they may not.
	 * An off-by-one here would refuse exactly the round number a business is most likely to pick.
	 */
	private static void requireAtMost(String subject, BigDecimal amount, BigDecimal maximum) {
		if (amount != null && amount.compareTo(maximum) > 0) {
			throw new ImplausibleAmountException(subject, amount, maximum);
		}
	}
}
