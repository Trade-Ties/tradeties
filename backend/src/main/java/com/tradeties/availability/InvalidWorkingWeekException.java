package com.tradeties.availability;

/**
 * The submitted week cannot exist: a day named twice, a block that ends before it starts, or two
 * blocks on one day that overlap.
 *
 * <p>The schema refuses the same things, but arriving there means a violation naming a
 * constraint, and the caller learns nothing about which day was wrong.
 */
public class InvalidWorkingWeekException extends RuntimeException {

	public InvalidWorkingWeekException(String message) {
		super(message);
	}
}
