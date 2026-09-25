package com.tradeties.business;

/**
 * One job out of the catalogue, as a customer would name it.
 *
 * @param code the job's stable identity, and what a client sends back. Labels are editorial and
 *        get rewritten; this does not
 * @param label what the customer reads
 * @param tradeCode the trade the job is filed under
 * @param tradeDisplayName that trade in words, shown beside the label so somebody can see the
 *        list understood them
 * @param offeredNearby whether anybody published who reaches the customer's postal code offers
 *        this today, or null when no postal code was given. Null and {@code FALSE} are different
 *        answers — one is "nobody asked", the other is "we looked" — and a caller that renders
 *        them alike tells somebody they cannot be helped before they have said where they are
 */
public record ServiceSuggestion(String code, String label, String tradeCode, String tradeDisplayName,
		Boolean offeredNearby) {
}
