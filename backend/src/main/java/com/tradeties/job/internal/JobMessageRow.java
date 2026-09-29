package com.tradeties.job.internal;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One line of a conversation about a request, from the customer or from the business.
 *
 * <p>Written once and never edited: a message somebody has read is not a draft. The only thing
 * that changes afterwards is {@code readAt}, and only once.
 */
@Entity
@Table(name = "job_message")
class JobMessageRow {

	enum Author {
		BUSINESS, CUSTOMER
	}

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "job_request_id", nullable = false, updatable = false)
	private UUID jobRequestId;

	@Enumerated(EnumType.STRING)
	@Column(name = "author", nullable = false, updatable = false, length = 16)
	private Author author;

	@Column(name = "body", nullable = false, updatable = false, length = 5000)
	private String body;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "read_at")
	private Instant readAt;

	protected JobMessageRow() {
		// for JPA
	}

	JobMessageRow(UUID jobRequestId, Author author, String body, Instant now) {
		this.jobRequestId = jobRequestId;
		this.author = author;
		this.body = body;
		this.createdAt = now;
	}

	UUID id() {
		return id;
	}

	UUID jobRequestId() {
		return jobRequestId;
	}

	Author author() {
		return author;
	}

	String body() {
		return body;
	}

	Instant createdAt() {
		return createdAt;
	}

	boolean unread() {
		return readAt == null;
	}
}
