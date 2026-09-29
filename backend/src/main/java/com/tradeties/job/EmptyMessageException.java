package com.tradeties.job;

/** A message with nothing in it but whitespace, which the contract's length check lets through. */
public class EmptyMessageException extends RuntimeException {

	public EmptyMessageException() {
		super("A message needs some text.");
	}
}
