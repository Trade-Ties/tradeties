package com.tradeties.job;

/**
 * No job behind this access token — never issued, or expired. One exception for both, because
 * one answer is what the caller gets: telling them apart would confirm a guessed token had been
 * real once.
 */
public class NoSuchJobException extends RuntimeException {

	public NoSuchJobException() {
		super("No request was found for this link. It may have expired.");
	}
}
