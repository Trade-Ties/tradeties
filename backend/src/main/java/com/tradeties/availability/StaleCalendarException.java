package com.tradeties.availability;

/**
 * The version sent is not the stored one. Raised where the version is compared, so the sentence
 * can name what changed — this module now has more than one versioned resource.
 */
public class StaleCalendarException extends RuntimeException {

	public StaleCalendarException(String message) {
		super(message);
	}
}
