package com.tradeties.business;

/**
 * A 400 rather than a 409 — nothing raced, the selection named something that was never
 * choosable.
 */
public class InvalidSelectionException extends RuntimeException {

	public InvalidSelectionException(String message) {
		super(message);
	}
}
