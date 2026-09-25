package com.tradeties.business;

import java.time.Instant;
import java.util.UUID;

/**
 * One phrase the catalogue could not name, and how often it has come up.
 *
 * <p>Collected without anybody deciding to: a customer described work and no entry matched, or a
 * tradesperson named work they do and no entry matched. Neither is an error — the catalogue does
 * not know every job, and this is how it learns which ones.
 *
 * @param phrase as typed, with whitespace tidied and nothing else changed. How people write is
 *        what somebody reading this is trying to learn
 * @param seenCount how often it has been said, counted without regard to capitalisation. The
 *        figure that separates a missing job from somebody's typo
 * @param firstSeenAt never updated, and the other half of the count: eighteen times since Tuesday
 *        and eighteen times since March say different things about the same number
 * @param promotedTo the catalogue entry this became, or null while it is anything else
 */
public record CatalogSuggestion(UUID id, SuggestionSource source, String phrase, int seenCount,
		Instant firstSeenAt, Instant lastSeenAt, SuggestionStatus status, UUID promotedTo) {
}
