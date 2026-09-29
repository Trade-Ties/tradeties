package com.tradeties.job;

/** An appointment that could never be stored as sent — a 400, because nothing raced. */
public class InvalidAppointmentException extends RuntimeException {

	public InvalidAppointmentException(String message) {
		super(message);
	}
}
