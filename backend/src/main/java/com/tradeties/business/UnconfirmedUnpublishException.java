package com.tradeties.business;

/**
 * A removal refused because it would take a published profile off the marketplace, and nobody has
 * said that is what they meant.
 *
 * <p>The other answer to the question {@link LiveProfileNotReadyException} refuses outright, and
 * the difference is what the caller asked for. Giving up a trade is not a request to stop trading,
 * so that change is turned down. Deleting the only service anybody can book is a decision about
 * exactly that — so it is put to the holder, and taken if they say yes.
 *
 * <p>The message is written for them rather than for a log: the confirmation dialogue shows it
 * verbatim and adds nothing.
 */
public class UnconfirmedUnpublishException extends RuntimeException {

	public UnconfirmedUnpublishException() {
		super("That is the only service anybody can book, so removing it takes your profile off "
				+ "the marketplace. It goes back to being a draft — nothing else you have entered "
				+ "is lost, and you can publish again as soon as you add a service.");
	}
}
