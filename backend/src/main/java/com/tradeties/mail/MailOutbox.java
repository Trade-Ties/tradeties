package com.tradeties.mail;

/**
 * Where a module leaves an email to be sent.
 *
 * <p><strong>Only inside a transaction the caller already holds.</strong> The message is written
 * beside whatever the caller is writing, so the two commit together or not at all: a request that
 * rolls back must not leave a confirmation behind, and one that commits must not lose its
 * confirmation to a mail server that was down for a minute. Called without a transaction, it
 * refuses rather than quietly committing the message on its own.
 */
public interface MailOutbox {

	void enqueue(OutgoingMail mail);
}
