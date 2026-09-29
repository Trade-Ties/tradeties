package com.tradeties.job;

import java.util.List;
import java.util.UUID;

import com.tradeties.generated.api.InboxApi;
import com.tradeties.generated.model.Conversation;
import com.tradeties.generated.model.ConversationSummary;
import com.tradeties.generated.model.Message;
import com.tradeties.generated.model.MessageInput;
import com.tradeties.identity.CurrentMarketplaceUser;
import com.tradeties.job.internal.ConversationService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * The tradesperson's inbox. Every operation resolves the business from the caller's token; a
 * request id in the path is only ever checked against it, never trusted on its own.
 */
@RestController
class InboxController implements InboxApi {

	private final CurrentMarketplaceUser currentMarketplaceUser;
	private final ConversationService conversations;

	InboxController(CurrentMarketplaceUser currentMarketplaceUser, ConversationService conversations) {
		this.currentMarketplaceUser = currentMarketplaceUser;
		this.conversations = conversations;
	}

	@Override
	public ResponseEntity<List<ConversationSummary>> listMyConversations() {
		return ResponseEntity.ok(conversations.inboxForOwner(owner()).stream()
				.map(entry -> new ConversationSummary()
						.requestId(entry.requestId())
						.customerName(entry.customerName())
						.request(Wire.summary(entry.request()))
						.lastMessage(Wire.message(entry.lastMessage()))
						.unreadCount(entry.unreadCount()))
				.toList());
	}

	@Override
	public ResponseEntity<Conversation> getMyConversation(UUID requestId) {
		ConversationDetail detail = conversations.conversationForOwner(owner(), requestId);

		return ResponseEntity.ok(new Conversation()
				.request(Wire.summary(detail.request()))
				.customerName(detail.customerName())
				.customerEmail(detail.customerEmail())
				.customerPhone(detail.customerPhone())
				.description(detail.description())
				.address(Wire.address(detail.address()))
				.requestedAt(Wire.utc(detail.requestedAt()))
				.messages(detail.messages().stream().map(Wire::message).toList()));
	}

	@Override
	public ResponseEntity<Message> sendMyMessage(UUID requestId, MessageInput messageInput) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(Wire.message(conversations.replyAsOwner(owner(), requestId, messageInput.getBody())));
	}

	@Override
	public ResponseEntity<Void> markMyConversationRead(UUID requestId) {
		conversations.markReadByOwner(owner(), requestId);
		return ResponseEntity.noContent().build();
	}

	private UUID owner() {
		return currentMarketplaceUser.requireTradesperson().id();
	}
}
