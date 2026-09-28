package com.tradeties.job;

/**
 * The start that was sent is not one this business offers for this service right now.
 *
 * <p>A 400 rather than a 409, although a race is one way to reach it. The other ways are a page
 * left open for a day, a link somebody kept, and a start nobody was ever offered — and all four
 * are answered the same way, by reading the calendar again. Calling it a conflict would suggest
 * the request could be retried as sent.
 *
 * <p>Its own type rather than {@code business}'s {@code InvalidSelectionException}, because the
 * two are corrected differently: that one means a value was never choosable, this one means the
 * time has moved on.
 */
public class SlotNotOfferedException extends RuntimeException {

	public SlotNotOfferedException(String message) {
		super(message);
	}
}
