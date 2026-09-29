package com.tradeties.job.internal;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.tradeties.business.BusinessNames;
import com.tradeties.business.BusinessNames.BusinessName;
import com.tradeties.business.Businesses;
import com.tradeties.job.ConversationDetail;
import com.tradeties.job.ConversationMessage;
import com.tradeties.job.EmptyMessageException;
import com.tradeties.job.InboxEntry;
import com.tradeties.job.JobForCustomer;
import com.tradeties.job.NoSuchConversationException;
import com.tradeties.mail.MailOutbox;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The conversation between a customer and the business a request went to — both sides of it.
 *
 * <p><strong>One thread per request.</strong> The request is the pairing of one customer with one
 * business, and a job sent to several businesses must not let one of them read what another
 * wrote. So every lookup here goes through a request, and every request is checked against
 * whoever is asking: the business that owns it, or the token of the job it belongs to.
 *
 * <p>A request another business owns and one that does not exist are the same answer, in both
 * directions — an id says nothing about conversations that are not the caller's.
 */
@Service
public class ConversationService {

	private final Businesses businesses;
	private final BusinessNames businessNames;
	private final JobRepository jobs;
	private final JobRequestRepository requests;
	private final JobMessageRepository messages;
	private final JobAccess access;
	private final MailOutbox mail;
	private final String publicUrl;

	ConversationService(Businesses businesses,
			BusinessNames businessNames,
			JobRepository jobs,
			JobRequestRepository requests,
			JobMessageRepository messages,
			JobAccess access,
			MailOutbox mail,
			@Value("${tradeties.public-url}") String publicUrl) {

		this.businesses = businesses;
		this.businessNames = businessNames;
		this.jobs = jobs;
		this.requests = requests;
		this.messages = messages;
		this.access = access;
		this.mail = mail;
		this.publicUrl = publicUrl.replaceAll("/+$", "");
	}

	// ------------------------------------------------------------------ the business's side

	/**
	 * The inbox: every request sent to the caller's business, latest activity first.
	 *
	 * @throws NoSuchConversationException the caller has no business yet
	 */
	@Transactional(readOnly = true)
	public List<InboxEntry> inboxForOwner(UUID ownerUserId) {
		UUID businessId = businessOf(ownerUserId);
		List<JobRequestRow> sent = requests.findByBusinessId(businessId);
		if (sent.isEmpty()) {
			return List.of();
		}

		Map<UUID, JobRow> jobsById = jobs.findAllById(sent.stream().map(JobRequestRow::jobId).distinct().toList())
				.stream().collect(Collectors.toMap(JobRow::id, Function.identity()));
		Map<UUID, List<JobMessageRow>> threads = messages
				.findByJobRequestIdInOrderByCreatedAtAsc(sent.stream().map(JobRequestRow::id).toList())
				.stream().collect(Collectors.groupingBy(JobMessageRow::jobRequestId));
		BusinessName name = businessNames.byIds(List.of(businessId)).get(businessId);

		return sent.stream()
				.map(request -> {
					JobRow job = jobsById.get(request.jobId());
					List<JobMessageRow> thread = threads.getOrDefault(request.id(), List.of());

					// The description is the first line until somebody writes after it.
					ConversationMessage last = thread.isEmpty()
							? opening(request, job)
							: Summaries.of(thread.getLast());
					int unread = (int) thread.stream()
							.filter(m -> m.author() == JobMessageRow.Author.CUSTOMER && m.unread())
							.count();

					return new InboxEntry(request.id(), job.customerName(), Summaries.of(request, job, name), last,
							unread);
				})
				.sorted(Comparator.comparing((InboxEntry entry) -> entry.lastMessage().sentAt()).reversed())
				.toList();
	}

	/** @throws NoSuchConversationException not a request of the caller's business */
	@Transactional(readOnly = true)
	public ConversationDetail conversationForOwner(UUID ownerUserId, UUID requestId) {
		JobRequestRow request = ownedRequest(ownerUserId, requestId);
		JobRow job = jobs.findById(request.jobId()).orElseThrow(NoSuchConversationException::new);
		BusinessName name = businessNames.byIds(List.of(request.businessId())).get(request.businessId());

		return new ConversationDetail(
				Summaries.of(request, job, name),
				job.customerName(),
				job.customerEmail(),
				job.customerPhone(),
				// Empty rather than absent for an appointment the business booked itself, which
				// may have been entered with no description at all.
				job.description() == null ? "" : job.description(),
				job.address(),
				request.createdAt(),
				messages.findByJobRequestIdOrderByCreatedAtAsc(requestId).stream().map(Summaries::of).toList());
	}

	/**
	 * The business answers. Stored, and emailed to the customer with a fresh link back — written
	 * in this transaction, so the message and its email commit together.
	 *
	 * @throws NoSuchConversationException not a request of the caller's business
	 * @throws EmptyMessageException nothing but whitespace
	 */
	@Transactional
	public ConversationMessage replyAsOwner(UUID ownerUserId, UUID requestId, String body) {
		String text = requireText(body);
		JobRequestRow request = ownedRequest(ownerUserId, requestId);
		JobRow job = jobs.findById(request.jobId()).orElseThrow(NoSuchConversationException::new);
		BusinessName name = businessNames.byIds(List.of(request.businessId())).get(request.businessId());

		JobMessageRow saved = messages.save(
				new JobMessageRow(requestId, JobMessageRow.Author.BUSINESS, text, Instant.now()));

		// An appointment the business booked itself may have no address to write to. The reply is
		// kept either way — it is their record of what was said — and nobody is emailed.
		if (job.customerEmail() == null || job.customerEmail().isBlank()) {
			return Summaries.of(saved);
		}

		JobAccess.IssuedLink link = access.issue(job);
		mail.enqueue(ConversationMail.toCustomer(
				job.customerEmail(),
				job.customerName(),
				name == null ? "The tradesperson" : name.displayName(),
				text,
				requestLink(name, link.token()),
				link.expiresAt(),
				job.timeZone()));

		return Summaries.of(saved);
	}

	/**
	 * Everything the customer has written so far, seen.
	 *
	 * @throws NoSuchConversationException not a request of the caller's business
	 */
	@Transactional
	public void markReadByOwner(UUID ownerUserId, UUID requestId) {
		ownedRequest(ownerUserId, requestId);
		messages.markCustomerMessagesRead(requestId, Instant.now());
	}

	// ------------------------------------------------------------------ the customer's side

	/**
	 * The job a customer's token opens, with every request on it and each one's conversation.
	 * Empty for a token never issued and one that has expired alike.
	 */
	@Transactional(readOnly = true)
	public Optional<JobForCustomer> jobForCustomer(String token) {
		return access.open(token).map(this::forCustomer);
	}

	/**
	 * The customer writes. The request has to belong to the job the token opens — a token for one
	 * job reaches no other job's conversation — and the business is told by email.
	 *
	 * @throws NoSuchConversationException the token opens nothing, or not this request
	 * @throws EmptyMessageException nothing but whitespace
	 */
	@Transactional
	public ConversationMessage replyAsCustomer(String token, UUID requestId, String body) {
		String text = requireText(body);
		JobRow job = access.open(token).orElseThrow(NoSuchConversationException::new);
		JobRequestRow request = requests.findById(requestId)
				.filter(found -> found.jobId().equals(job.id()))
				.orElseThrow(NoSuchConversationException::new);

		JobMessageRow saved = messages.save(
				new JobMessageRow(requestId, JobMessageRow.Author.CUSTOMER, text, Instant.now()));

		BusinessName name = businessNames.byIds(List.of(request.businessId())).get(request.businessId());
		// A business with no address on file is told nothing, and loses nothing: the message is
		// stored and waiting in the inbox either way.
		if (name != null && name.email() != null && !name.email().isBlank()) {
			mail.enqueue(ConversationMail.toBusiness(name.email(), job.customerName(), request.serviceName(), text,
					publicUrl, requestId));
		}

		return Summaries.of(saved);
	}

	private JobForCustomer forCustomer(JobRow job) {
		List<JobRequestRow> sent = requests.findByJobIdOrderByCreatedAtDesc(job.id());
		Map<UUID, BusinessName> names =
				businessNames.byIds(sent.stream().map(JobRequestRow::businessId).distinct().toList());
		Map<UUID, List<JobMessageRow>> threads = messages
				.findByJobRequestIdInOrderByCreatedAtAsc(sent.stream().map(JobRequestRow::id).toList())
				.stream().collect(Collectors.groupingBy(JobMessageRow::jobRequestId));

		return new JobForCustomer(
				job.id(),
				job.customerName(),
				job.customerEmail(),
				job.customerPhone(),
				job.description(),
				job.address(),
				job.accessTokenExpiresAt(),
				sent.stream()
						.map(request -> new JobForCustomer.RequestThread(
								Summaries.of(request, job, names.get(request.businessId())),
								threads.getOrDefault(request.id(), List.of()).stream().map(Summaries::of).toList()))
						.toList());
	}

	// ------------------------------------------------------------------ shared

	private UUID businessOf(UUID ownerUserId) {
		return businesses.findIdByOwner(ownerUserId).orElseThrow(NoSuchConversationException::new);
	}

	private JobRequestRow ownedRequest(UUID ownerUserId, UUID requestId) {
		UUID businessId = businessOf(ownerUserId);
		return requests.findById(requestId)
				.filter(request -> request.businessId().equals(businessId))
				.orElseThrow(NoSuchConversationException::new);
	}

	/**
	 * The customer's description, standing in as a conversation's first line — or, for an
	 * appointment the business booked itself and described with nothing, a line saying so.
	 */
	private static ConversationMessage opening(JobRequestRow request, JobRow job) {
		boolean described = job.description() != null && !job.description().isBlank();

		return described
				? new ConversationMessage(request.id(), JobMessageRow.Author.CUSTOMER.name(), job.description(),
						request.createdAt())
				: new ConversationMessage(request.id(), JobMessageRow.Author.BUSINESS.name(),
						"You booked this appointment.", request.createdAt());
	}

	/** The request's page, as the booking form and the confirmation spell it. */
	private String requestLink(BusinessName name, String token) {
		String slug = name == null || name.slug() == null || name.slug().isBlank() ? "request" : name.slug();
		return publicUrl + "/" + slug + "/requests/" + token;
	}

	private static String requireText(String body) {
		if (body == null || body.isBlank()) {
			throw new EmptyMessageException();
		}
		return body.strip();
	}
}
