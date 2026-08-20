package com.tradeties.business;

/**
 * The time zone was changed on a business that already has working hours, without saying so on
 * purpose.
 *
 * <p>Working hours are local wall clock, so they do not move: Monday 08:00 stays Monday 08:00.
 * What moves is the instant behind it, and with it every free slot the business offers. The
 * confirmation is asked because the form that changes the zone is step 2 while the thing it moves
 * is step 7, and nothing on the screen connects the two.
 *
 * <p>A 409 rather than a 400: the request is well formed and the change is allowed — what is
 * missing is not a field but an answer. It carries an RFC 9457 {@code type} because the client
 * has to answer it with a dialogue and a resend rather than a sentence on the screen.
 *
 * <p>Nothing to move, nothing to ask: a business with no working hours never sees this, and
 * neither does one whose zone is not actually changing.
 */
public class UnconfirmedTimeZoneChangeException extends RuntimeException {

	public UnconfirmedTimeZoneChangeException(String from, String to) {
		super("Changing the time zone from " + from + " to " + to + " moves this whole business's "
				+ "calendar. The working hours keep their clock times and land at different moments, "
				+ "so every free slot moves with them. Send the same change again with "
				+ "timeZoneChangeConfirmed: true.");
	}
}
