package com.tradeties.mail.internal;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import com.tradeties.mail.OutgoingMail;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One email, from the moment somebody asked for it until it went — or until trying stopped.
 *
 * <p>The three ways a row moves are the three methods below, and each keeps the checks in the
 * migration true on its own: sending empties the body in the same breath as it stamps the time,
 * so no row can be SENT with a body still in it or PENDING without one.
 */
@Entity
@Table(name = "mail_outbox")
class OutboxRow {

	/** Room the column has for a refusal; anything longer is cut, not refused. */
	private static final int ERROR_LENGTH = 500;

	enum Status {
		PENDING, SENT, FAILED
	}

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "recipient", nullable = false, updatable = false)
	private String recipient;

	@Column(name = "subject", nullable = false, updatable = false)
	private String subject;

	@Column(name = "body")
	private String body;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false)
	private Status status;

	@Column(name = "attempts", nullable = false)
	private int attempts;

	@Column(name = "next_attempt_at", nullable = false)
	private Instant nextAttemptAt;

	@Column(name = "last_error")
	private String lastError;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "sent_at")
	private Instant sentAt;

	protected OutboxRow() {
		// for JPA
	}

	/** Due at once: the first attempt is the next pass of the sender. */
	OutboxRow(OutgoingMail mail, Instant now) {
		this.recipient = mail.to();
		this.subject = mail.subject();
		this.body = mail.body();
		this.status = Status.PENDING;
		this.attempts = 0;
		this.nextAttemptAt = now;
		this.createdAt = now;
	}

	UUID id() {
		return id;
	}

	String recipient() {
		return recipient;
	}

	String subject() {
		return subject;
	}

	String body() {
		return body;
	}

	Status status() {
		return status;
	}

	int attempts() {
		return attempts;
	}

	Instant nextAttemptAt() {
		return nextAttemptAt;
	}

	String lastError() {
		return lastError;
	}

	/**
	 * Gone. The body goes with it: it may carry a customer's access link, and a sent message has
	 * no further use for its text that could justify keeping a credential in the clear.
	 */
	void sent(Instant now) {
		this.status = Status.SENT;
		this.sentAt = now;
		this.body = null;
		this.lastError = null;
	}

	/**
	 * Refused this time. Tried again after {@code wait}, or not at all once the attempts run out —
	 * a FAILED row keeps its body, so whoever looks into it can see what was never delivered.
	 */
	void refused(String error, Instant now, Duration wait, int maxAttempts) {
		this.attempts++;
		this.lastError = error == null ? null : error.substring(0, Math.min(error.length(), ERROR_LENGTH));

		if (attempts >= maxAttempts) {
			this.status = Status.FAILED;
		} else {
			this.nextAttemptAt = now.plus(wait);
		}
	}
}
