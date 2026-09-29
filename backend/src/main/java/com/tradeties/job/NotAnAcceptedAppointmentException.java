package com.tradeties.job;

/**
 * Only an accepted appointment can be moved or removed: a pending request is answered instead, and
 * one declined, withdrawn or cancelled no longer holds any time. A 422, because no retry changes it.
 */
public class NotAnAcceptedAppointmentException extends RuntimeException {

	public NotAnAcceptedAppointmentException(String message) {
		super(message);
	}
}
