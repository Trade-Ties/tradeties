package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface JobAccessTokenRepository extends JpaRepository<JobAccessTokenRow, String> {

	/** The job an extra link opens, while it still opens one. */
	Optional<JobAccessTokenRow> findByTokenHashAndExpiresAtAfter(String tokenHash, Instant now);
}
