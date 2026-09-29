package com.tradeties.job;

import java.util.UUID;

import com.tradeties.business.PostalAddress;
import com.tradeties.generated.api.JobApi;
import com.tradeties.generated.model.CreatedJob;
import com.tradeties.generated.model.CustomerJob;
import com.tradeties.generated.model.CustomerRequest;
import com.tradeties.generated.model.JobInput;
import com.tradeties.generated.model.JobRequestStatus;
import com.tradeties.generated.model.JobRequestSummary;
import com.tradeties.generated.model.Message;
import com.tradeties.generated.model.MessageInput;
import com.tradeties.job.internal.ConversationService;
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
	private final ConversationService conversations;

	JobController(JobService jobs, ConversationService conversations) {
		this.jobs = jobs;
		this.conversations = conversations;
	}

	@Override
	public ResponseEntity<CreatedJob> createJob(JobInput input) {
		return ResponseEntity.status(HttpStatus.CREATED).body(toWire(jobs.place(toDomain(input))));
	}

	/**
	 * The token arrives in a header and goes no further than the lookup: it is not echoed back, not
	 * logged, and not part of the path, where every proxy on the way would have written it down.
	 */
	@Override
	public ResponseEntity<CustomerJob> getJobByToken(String xJobToken) {
		JobForCustomer job = conversations.jobForCustomer(xJobToken).orElseThrow(NoSuchJobException::new);

		return ResponseEntity.ok(new CustomerJob()
				.jobId(job.jobId())
				.customerName(job.customerName())
				.customerEmail(job.customerEmail())
				.customerPhone(job.customerPhone())
				.description(job.description())
				.address(Wire.address(job.address()))
				.accessTokenExpiresAt(Wire.utc(job.accessTokenExpiresAt()))
				.requests(job.requests().stream()
						.map(thread -> new CustomerRequest()
								.request(Wire.summary(thread.request()))
								.messages(thread.messages().stream().map(Wire::message).toList()))
						.toList()));
	}

	/** The customer's side of the conversation, with the same token in the same header. */
	@Override
	public ResponseEntity<Message> sendCustomerMessage(String xJobToken, UUID requestId, MessageInput messageInput) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(Wire.message(conversations.replyAsCustomer(xJobToken, requestId, messageInput.getBody())));
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
				.accessTokenExpiresAt(Wire.utc(placed.accessTokenExpiresAt()))
				.request(summary(placed));
	}

	private static JobRequestSummary summary(PlacedJob placed) {
		return new JobRequestSummary()
				.id(placed.requestId())
				// A customer's request always arrives pending; only the business answers it.
				.status(JobRequestStatus.PENDING)
				.businessSlug(placed.businessSlug())
				.businessName(placed.businessName())
				.serviceName(placed.serviceName())
				.estimatedDurationMinutes(placed.estimatedDurationMinutes())
				.startsAt(Wire.utc(placed.startsAt()))
				.endsAt(Wire.utc(placed.endsAt()))
				.timeZone(placed.timeZone())
				.currency(placed.currency())
				.cancellationFee(placed.cancellationFee().toPlainString())
				.cancellationNoticeHours(placed.cancellationNoticeHours());
	}
}
