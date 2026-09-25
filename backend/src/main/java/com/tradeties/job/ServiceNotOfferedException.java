package com.tradeties.job;

/**
 * The business exists and is published, but does not offer the service that was named — or has
 * retired it since the page was drawn.
 *
 * <p>A 400 and not a 404: the address was right, one value in the body was not. Kept apart from
 * {@link SlotNotOfferedException} because the two send somebody to different places — this one to
 * the profile to choose again, that one to the calendar to pick another time.
 */
public class ServiceNotOfferedException extends RuntimeException {

	public ServiceNotOfferedException(String message) {
		super(message);
	}
}
