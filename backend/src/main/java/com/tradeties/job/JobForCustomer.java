package com.tradeties.job;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.tradeties.business.PostalAddress;

/**
 * A job as the customer who sent it sees it, read back through their access token.
 *
 * <p>Their own details and nothing else. Whoever holds the token already had all of it — they
 * typed it — so nothing here is disclosed by the token that the token's holder did not write.
 *
 * @param requests newest first, each with its conversation
 */
public record JobForCustomer(
		UUID jobId,
		String customerName,
		String customerEmail,
		String customerPhone,
		String description,
		PostalAddress address,
		Instant accessTokenExpiresAt,
		List<RequestThread> requests) {

	/**
	 * One request and the conversation about it.
	 *
	 * @param messages oldest first
	 */
	public record RequestThread(RequestSummary request, List<ConversationMessage> messages) {
	}
}
