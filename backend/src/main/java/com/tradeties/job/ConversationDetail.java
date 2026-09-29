package com.tradeties.job;

import java.time.Instant;
import java.util.List;

import com.tradeties.business.PostalAddress;

/**
 * Everything a tradesperson needs to answer a request: what was asked, by whom, where, how to
 * reach them, and every message since.
 *
 * @param requestedAt when the request was sent — the moment {@code description} was written
 * @param messages oldest first
 */
public record ConversationDetail(
		RequestSummary request,
		String customerName,
		String customerEmail,
		String customerPhone,
		String description,
		PostalAddress address,
		Instant requestedAt,
		List<ConversationMessage> messages) {
}
