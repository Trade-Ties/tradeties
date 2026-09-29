package com.tradeties.job;

import java.util.UUID;

/**
 * One line of a tradesperson's inbox: whose request, about what, the latest thing said, and how
 * much of it they have not read.
 *
 * @param lastMessage the customer's description when nobody has written since the request
 */
public record InboxEntry(
		UUID requestId,
		String customerName,
		RequestSummary request,
		ConversationMessage lastMessage,
		int unreadCount) {
}
