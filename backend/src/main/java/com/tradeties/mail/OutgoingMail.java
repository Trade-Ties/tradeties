package com.tradeties.mail;

/**
 * An email to send: plain text, to one person.
 *
 * <p>Plain text on purpose, for now. It reads in every client, it cannot be mistaken for a
 * marketing template by a spam filter, and there is no second rendering to drift from the first.
 *
 * @param to the recipient's address, as they gave it
 */
public record OutgoingMail(String to, String subject, String body) {
}
