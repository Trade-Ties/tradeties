package com.tradeties.business;

/**
 * Which side said it.
 *
 * <p>Counted apart because they are different evidence about the same word: a tradesperson naming
 * work they do, and a customer naming work they want. A phrase only one side ever uses is worth
 * knowing about as such.
 */
public enum SuggestionSource {

	/** A tradesperson named a service the catalogue has no entry for. */
	PRO,

	/** A customer described work the catalogue could not name. */
	CUSTOMER
}
