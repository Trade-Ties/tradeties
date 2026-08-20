package com.tradeties.business;

import java.util.UUID;

/**
 * What other modules may report about the wizard's progress.
 *
 * <p>Declared here because the column lives here. {@code availability} owns steps 7 and 8 and
 * already depends on this module, so reporting the step through this port keeps that arrow
 * pointing the same way. An event would have reversed it and made the marker eventually
 * consistent, for a value the same wizard reads two clicks later.
 */
public interface OnboardingProgress {

	/**
	 * Idempotent, and monotonic: a step below the one already reached changes nothing, so a late
	 * correction to an early form cannot send a finished profile back to the beginning.
	 *
	 * <p>Advisory only. Nothing but the wizard reads the result — publishing is gated by the
	 * completeness check in {@code PublishService}, never by this number.
	 */
	void record(UUID businessId, OnboardingStep step);
}
