package com.tradeties.business;

/**
 * A suspended profile cannot be taken back to a draft by its holder. {@code SUSPENDED} is the
 * marketplace's decision, not the business's, and letting the holder move out of it would make it
 * a state they could simply step around.
 */
public class ProfileSuspendedException extends RuntimeException {

	public ProfileSuspendedException() {
		super("This profile is suspended. Only TradeTies can lift that.");
	}
}
