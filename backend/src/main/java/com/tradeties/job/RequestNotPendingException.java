package com.tradeties.job;

/**
 * The request has already been decided, withdrawn or cancelled, so there is nothing left to
 * answer.
 *
 * <p>A 422 rather than a 409, and the difference is whether trying again could ever work. A
 * conflict is a race somebody else won and the caller re-reads and acts; this is a request whose
 * story is over, and no amount of retrying reopens it.
 */
public class RequestNotPendingException extends RuntimeException {

	public RequestNotPendingException(String message) {
		super(message);
	}
}
