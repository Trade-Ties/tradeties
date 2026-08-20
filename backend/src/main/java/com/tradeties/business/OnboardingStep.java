package com.tradeties.business;

/**
 * The steps of the onboarding wizard, with the number {@code business_profile} stores.
 *
 * <p>The numbering lives here rather than at each write site, because it is one sequence and not
 * eight opinions.
 *
 * <p>Steps 1 and 2 share a constant. Step 1 is never saved on its own: the address, the time
 * zone and the service radius are all {@code NOT NULL}, so nothing is persistable until step 2
 * is complete, and the profile row therefore comes into existence at 2.
 */
public enum OnboardingStep {

	ADDRESS(2),

	TRADES(3),

	SERVICES(4),

	PRICING(5),

	/** Optional: a business may hold none and still move past this step. */
	LICENSES(6),

	/** Written by {@code availability}. */
	WORKING_HOURS(7),

	/** Written by {@code availability}. */
	BOOKING_RULES(8),

	/** Reached by publishing, not by saving a form. */
	PUBLISHED(9);

	private final short number;

	OnboardingStep(int number) {
		this.number = (short) number;
	}

	/**
	 * @return the value stored in {@code business_profile.onboarding_completed_step}, a
	 *         {@code short} matching the {@code SMALLINT} column and the
	 *         {@code CHECK (onboarding_completed_step BETWEEN 2 AND 9)} that guards it
	 */
	public short number() {
		return number;
	}
}
