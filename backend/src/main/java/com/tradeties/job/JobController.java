package com.tradeties.job;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import com.tradeties.business.PostalAddress;
import com.tradeties.generated.api.JobApi;
import com.tradeties.generated.model.CreatedJob;
import com.tradeties.generated.model.JobInput;
import com.tradeties.generated.model.JobRequestStatus;
import com.tradeties.generated.model.JobRequestSummary;
import com.tradeties.job.internal.JobService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * The customer's half of booking, and the only controller in this API that takes no token.
 *
 * <p>Nothing here reads who is calling, because there is nobody to read. What goes back instead
 * is an access token — an anonymous customer's entire way back to what they sent.
 */
@RestController
class JobController implements JobApi {

	private final JobService jobs;

	JobController(JobService jobs) {
		this.jobs = jobs;
	}

	@Override
	public ResponseEntity<CreatedJob> createJob(JobInput input) {
		return ResponseEntity.status(HttpStatus.CREATED).body(toWire(jobs.place(toDomain(input))));
	}

	private static NewJob toDomain(JobInput input) {
		return new NewJob(
				input.getSlug(),
				input.getServiceId(),
				input.getStartsAt().toInstant(),
				input.getCustomerName(),
				input.getCustomerEmail(),
				input.getCustomerPhone(),
				// Absent stays absent. The generated enum has no "not said" value, so null is
				// what carries it, and a default here would invent a preference.
				input.getPreferredContact() == null
						? null
						: ContactMethod.valueOf(input.getPreferredContact().getValue()),
				input.getDescription(),
				new PostalAddress(
						input.getStreet1(),
						input.getStreet2(),
						input.getCity(),
						input.getState(),
						input.getPostalCode()));
	}

	/**
	 * The token is written into the body here and nowhere else — not into a header, not into a log
	 * line. This is the one response in this API that carries a credential.
	 */
	private static CreatedJob toWire(PlacedJob placed) {
		return new CreatedJob()
				.jobId(placed.jobId())
				.accessToken(placed.accessToken())
				.accessTokenExpiresAt(utc(placed.accessTokenExpiresAt()))
				.request(summary(placed));
	}

	private static JobRequestSummary summary(PlacedJob placed) {
		return new JobRequestSummary()
				.id(placed.requestId())
				// Nothing can accept one yet, so a fresh request has only the one status.
				.status(JobRequestStatus.PENDING)
				.businessSlug(placed.businessSlug())
				.businessName(placed.businessName())
				.serviceName(placed.serviceName())
				.estimatedDurationMinutes(placed.estimatedDurationMinutes())
				.startsAt(utc(placed.startsAt()))
				.endsAt(utc(placed.endsAt()))
				.timeZone(placed.timeZone())
				.currency(placed.currency())
				.cancellationFee(placed.cancellationFee().toPlainString())
				.cancellationNoticeHours(placed.cancellationNoticeHours());
	}

	/**
	 * Instants go out at UTC rather than at the business's offset. The zone the reader needs is a
	 * field of its own, and an offset baked into the timestamp is the second copy of it that can
	 * disagree — over a daylight saving switch it would.
	 */
	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}
}
