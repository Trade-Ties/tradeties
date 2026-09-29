package com.tradeties.job;

/**
 * No conversation of the caller's at that id. The same answer for a request that does not exist
 * and one that belongs to another business, so an id says nothing about requests that are not
 * the caller's.
 */
public class NoSuchConversationException extends RuntimeException {

	public NoSuchConversationException() {
		super("No conversation of yours has that id.");
	}
}
