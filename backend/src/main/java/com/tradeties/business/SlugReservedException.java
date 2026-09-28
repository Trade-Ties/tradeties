package com.tradeties.business;

/**
 * A slug no business can have, whoever asks. Kept apart from {@link SlugTakenException} for the
 * sentence: "taken" says somebody else got there first, and a tradesperson told that about
 * {@code help} goes looking for whoever owns it.
 */
public class SlugReservedException extends RuntimeException {

	public SlugReservedException(String slug) {
		super("The address '" + slug + "' is reserved for TradeTies' own pages. Choose another.");
	}
}
