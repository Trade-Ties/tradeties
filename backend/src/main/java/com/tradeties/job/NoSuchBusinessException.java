package com.tradeties.job;

/**
 * No published business holds that slug.
 *
 * <p>A mistyped address, a profile taken back to draft and one the marketplace has suspended are
 * one answer here, exactly as they are on the profile itself: telling them apart would publish a
 * moderation decision to anybody who can type a URL.
 */
public class NoSuchBusinessException extends RuntimeException {

	public NoSuchBusinessException(String message) {
		super(message);
	}
}
