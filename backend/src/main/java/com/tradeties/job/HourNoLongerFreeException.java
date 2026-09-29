package com.tradeties.job;

/**
 * The hour cannot be committed: somebody else's request was accepted onto it, time off now covers
 * it, the travel time to a neighbouring job would not be left, or the business's own limit for
 * that day is full.
 *
 * <p>A 409, because it is the race DECISIONS section 1 resolves at acceptance and not before —
 * until this moment the same hour was legitimately on offer to everybody. Re-reading the list is
 * what the caller does next, and after that the answer may well be different.
 */
public class HourNoLongerFreeException extends RuntimeException {

	public HourNoLongerFreeException(String message) {
		super(message);
	}
}
