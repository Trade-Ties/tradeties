package com.tradeties.availability;

/** An entry that could never be stored as sent — a 400, because nothing raced. */
public class InvalidTimeOffException extends RuntimeException {

	public InvalidTimeOffException(String message) {
		super(message);
	}
}
