package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface JobRepository extends JpaRepository<JobRow, UUID> {

	/**
	 * The job a token opens, if it still opens one. Looked up by the digest — the clear token is
	 * never stored, so it cannot be compared — and only while it has not expired: an expired token
	 * finds nothing, exactly like one that never existed.
	 */
	Optional<JobRow> findByAccessTokenHashAndAccessTokenExpiresAtAfter(String accessTokenHash, Instant now);
}
