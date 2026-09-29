package com.tradeties.job.internal;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A further way back into a job, issued for one email after the first. Stored as the job's own
 * token is — a digest and an expiry — and for the same reason: the clear value belongs in the
 * email and nowhere else.
 */
@Entity
@Table(name = "job_access_token")
class JobAccessTokenRow {

	@Id
	@Column(name = "token_hash", nullable = false, updatable = false, length = 64)
	private String tokenHash;

	@Column(name = "job_id", nullable = false, updatable = false)
	private UUID jobId;

	@Column(name = "expires_at", nullable = false, updatable = false)
	private Instant expiresAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected JobAccessTokenRow() {
		// for JPA
	}

	JobAccessTokenRow(String tokenHash, UUID jobId, Instant expiresAt, Instant now) {
		this.tokenHash = tokenHash;
		this.jobId = jobId;
		this.expiresAt = expiresAt;
		this.createdAt = now;
	}

	UUID jobId() {
		return jobId;
	}
}
