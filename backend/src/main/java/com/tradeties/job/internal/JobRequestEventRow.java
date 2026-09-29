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

import org.hibernate.annotations.Immutable;

/**
 * One change of status in a request's history. {@link Immutable}, because the table is only worth
 * something as evidence while no row in it is ever rewritten.
 */
@Entity
@Immutable
@Table(name = "job_request_event")
class JobRequestEventRow {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "request_id", nullable = false)
	private UUID requestId;

	@Column(name = "sequence_number", nullable = false)
	private int sequenceNumber;

	@Enumerated(EnumType.STRING)
	@Column(name = "from_status", length = 32)
	private RequestStatus fromStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "to_status", nullable = false, length = 32)
	private RequestStatus toStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "actor", nullable = false, length = 16)
	private Actor actor;

	@Column(name = "note", length = 500)
	private String note;

	@Column(name = "occurred_at", nullable = false)
	private Instant occurredAt;

	protected JobRequestEventRow() {
		// for JPA
	}

	JobRequestEventRow(UUID requestId, int sequenceNumber, RequestStatus fromStatus, RequestStatus toStatus,
			Actor actor, String note, Instant occurredAt) {

		this.requestId = requestId;
		this.sequenceNumber = sequenceNumber;
		this.fromStatus = fromStatus;
		this.toStatus = toStatus;
		this.actor = actor;
		this.note = note;
		this.occurredAt = occurredAt;
	}
}
