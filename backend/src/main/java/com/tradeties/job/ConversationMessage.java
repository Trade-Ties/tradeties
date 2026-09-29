package com.tradeties.job;

import java.time.Instant;
import java.util.UUID;

/**
 * One line of a conversation.
 *
 * @param author {@code BUSINESS} or {@code CUSTOMER}, the wire's spelling
 */
public record ConversationMessage(UUID id, String author, String body, Instant sentAt) {
}
