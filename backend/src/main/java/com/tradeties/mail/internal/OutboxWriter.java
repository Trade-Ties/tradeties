package com.tradeties.mail.internal;

import java.time.Instant;

import com.tradeties.mail.MailOutbox;
import com.tradeties.mail.OutgoingMail;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code MANDATORY} is the whole point of this class. It joins the caller's transaction, so the
 * message commits with whatever the caller wrote — and without one it throws, rather than opening
 * its own and leaving an email behind for something that never happened.
 */
@Component
class OutboxWriter implements MailOutbox {

	private final OutboxRepository outbox;

	OutboxWriter(OutboxRepository outbox) {
		this.outbox = outbox;
	}

	@Override
	@Transactional(propagation = Propagation.MANDATORY)
	public void enqueue(OutgoingMail mail) {
		outbox.save(new OutboxRow(mail, Instant.now()));
	}
}
