package com.tradeties.business;

/**
 * Expected rather than exceptional: the availability check is a snapshot, not a
 * reservation, so two tradespeople can both be told a slug is free and only one of them
 * can have it.
 */
public class SlugTakenException extends RuntimeException {

	public SlugTakenException(String slug) {
		super("The slug '" + slug + "' is already taken");
	}
}
