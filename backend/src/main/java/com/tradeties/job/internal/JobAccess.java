package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Optional;

import org.springframework.stereotype.Component;

/**
 * Every way a customer gets back into their job: the token from their confirmation, and the fresh
 * one each later email carries.
 *
 * <p>Both are held as digests with an expiry, so a token is only ever compared by its hash and an
 * expired one opens nothing, exactly like one never issued.
 */
@Component
class JobAccess {

	private final JobRepository jobs;
	private final JobAccessTokenRepository extraTokens;

	JobAccess(JobRepository jobs, JobAccessTokenRepository extraTokens) {
		this.jobs = jobs;
		this.extraTokens = extraTokens;
	}

	/** The job a token opens, if it still opens one — through either kind of link. */
	Optional<JobRow> open(String token) {
		String digest = AccessTokens.digest(token);
		Instant now = Instant.now();

		return jobs.findByAccessTokenHashAndAccessTokenExpiresAtAfter(digest, now)
				.or(() -> extraTokens.findByTokenHashAndExpiresAtAfter(digest, now)
						.flatMap(link -> jobs.findById(link.jobId())));
	}

	/**
	 * A new way back for one email. The clear value is returned for the caller to put in that
	 * email and is stored nowhere; the database keeps its digest, like the first one's.
	 */
	IssuedLink issue(JobRow job) {
		String token = AccessTokens.issue();
		Instant now = Instant.now();
		Instant expiresAt = now.plus(AccessTokens.LIFETIME);

		extraTokens.save(new JobAccessTokenRow(AccessTokens.digest(token), job.id(), expiresAt, now));
		return new IssuedLink(token, expiresAt);
	}

	record IssuedLink(String token, Instant expiresAt) {
	}
}
