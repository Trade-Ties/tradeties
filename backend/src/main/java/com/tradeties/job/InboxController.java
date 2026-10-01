package com.tradeties.job;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.List;
import java.util.UUID;

import com.tradeties.business.Businesses;
import com.tradeties.generated.api.InboxApi;
import com.tradeties.generated.model.AppointmentChange;
import com.tradeties.generated.model.AppointmentInput;
import com.tradeties.generated.model.BusinessJobRequest;
import com.tradeties.generated.model.Conversation;
import com.tradeties.generated.model.ConversationSummary;
import com.tradeties.generated.model.JobRequestDecline;
import com.tradeties.generated.model.JobRequestStatus;
import com.tradeties.generated.model.Message;
import com.tradeties.generated.model.MessageInput;
import com.tradeties.generated.model.Party;
import com.tradeties.identity.CurrentMarketplaceUser;
import com.tradeties.identity.MarketplaceUser;
import com.tradeties.job.internal.AppointmentService;
import com.tradeties.job.internal.ConversationService;
import com.tradeties.job.internal.InboxService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The tradesperson's side of the requests customers send, and of the conversation about each.
 *
 * <p>Apart from {@link JobController} although both belong to this module, because the two halves
 * have opposite security: that one takes no token by design, and nothing here may be reached
 * without one. A single class serving both is where an authentication mistake hides best.
 *
 * <p>The business is resolved from the token, never from a path variable, so there is no id for a
 * caller to swap for somebody else's inbox.
 */
@RestController
class InboxController implements InboxApi {

	/** The contract's `LocalDateTime`. Strict, or a 31st of February would quietly become the 28th. */
	private static final DateTimeFormatter WALL_CLOCK = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm")
			.withResolverStyle(ResolverStyle.STRICT);

	private final CurrentMarketplaceUser currentMarketplaceUser;
	private final Businesses businesses;
	private final InboxService inbox;
	private final AppointmentService appointments;
	private final ConversationService conversations;

	InboxController(CurrentMarketplaceUser currentMarketplaceUser,
			Businesses businesses,
			InboxService inbox,
			AppointmentService appointments,
			ConversationService conversations) {

		this.currentMarketplaceUser = currentMarketplaceUser;
		this.businesses = businesses;
		this.inbox = inbox;
		this.appointments = appointments;
		this.conversations = conversations;
	}

	// ------------------------------------------------------------------ the conversation per request

	@Override
	public ResponseEntity<List<ConversationSummary>> listMyConversations() {
		return ResponseEntity.ok(conversations.inboxForOwner(ownerId()).stream()
				.map(entry -> new ConversationSummary()
						.requestId(entry.requestId())
						.customerName(entry.customerName())
						.request(Wire.summary(entry.request()))
						.lastMessage(Wire.message(entry.lastMessage()))
						.unreadCount(entry.unreadCount()))
				.toList());
	}

	@Override
	public ResponseEntity<Conversation> getMyConversation(UUID requestId) {
		ConversationDetail detail = conversations.conversationForOwner(ownerId(), requestId);

		return ResponseEntity.ok(new Conversation()
				.request(Wire.summary(detail.request()))
				.customerName(detail.customerName())
				.customerEmail(detail.customerEmail())
				.customerPhone(detail.customerPhone())
				.description(detail.description())
				.address(Wire.address(detail.address()))
				.requestedAt(Wire.utc(detail.requestedAt()))
				.messages(detail.messages().stream().map(Wire::message).toList()));
	}

	@Override
	public ResponseEntity<Message> sendMyMessage(UUID requestId, MessageInput messageInput) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(Wire.message(conversations.replyAsOwner(ownerId(), requestId, messageInput.getBody())));
	}

	@Override
	public ResponseEntity<Void> markMyConversationRead(UUID requestId) {
		conversations.markReadByOwner(ownerId(), requestId);
		return ResponseEntity.noContent().build();
	}

	@Override
	public ResponseEntity<Void> deleteMyConversation(UUID requestId) {
		conversations.hideByOwner(ownerId(), requestId);
		return ResponseEntity.noContent().build();
	}

	/** The caller's own user id — the conversations resolve the business from it themselves. */
	private UUID ownerId() {
		return currentMarketplaceUser.requireTradesperson().id();
	}

	// ------------------------------------------------------------------ the requests and appointments

	@Override
	public ResponseEntity<BusinessJobRequest> bookAppointment(AppointmentInput input) {
		AppointmentDetails details = new AppointmentDetails(
				wallClock(input.getStartsAt()), wallClock(input.getEndsAt()),
				input.getCustomerName(), input.getCustomerPhone(), input.getCustomerEmail(),
				input.getStreet1(), input.getCity(), input.getState(), input.getPostalCode(), input.getNotes());

		BusinessRequest booked = appointments
				.book(myBusiness(), new NewAppointment(input.getServiceId(), input.getReplacesRequestId(), details,
						resolutions(input.getResolutions())))
				.orElseThrow(InboxController::noSuchRequest);

		return ResponseEntity.status(HttpStatus.CREATED).body(toWire(booked));
	}

	@Override
	public ResponseEntity<BusinessJobRequest> changeAppointment(UUID requestId, AppointmentChange change) {
		AppointmentDetails details = new AppointmentDetails(
				wallClock(change.getStartsAt()), wallClock(change.getEndsAt()),
				change.getCustomerName(), change.getCustomerPhone(), change.getCustomerEmail(),
				change.getStreet1(), change.getCity(), change.getState(), change.getPostalCode(), change.getNotes());

		return ResponseEntity.ok(appointments.change(myBusiness(), requestId, details,
						resolutions(change.getResolutions()))
				.map(InboxController::toWire)
				.orElseThrow(InboxController::noSuchRequest));
	}

	@Override
	public ResponseEntity<Void> removeAppointment(UUID requestId) {
		if (!appointments.remove(myBusiness(), requestId)) {
			throw noSuchRequest();
		}

		return ResponseEntity.noContent().build();
	}

	@Override
	public ResponseEntity<List<BusinessJobRequest>> listMyJobRequests(JobRequestStatus status) {
		List<BusinessRequest> found = inbox.list(myBusiness(),
				status == null ? null : RequestState.valueOf(status.getValue()));

		return ResponseEntity.ok(found.stream().map(InboxController::toWire).toList());
	}

	@Override
	public ResponseEntity<BusinessJobRequest> acceptJobRequest(UUID requestId) {
		return ResponseEntity.ok(inbox.accept(myBusiness(), requestId)
				.map(InboxController::toWire)
				.orElseThrow(InboxController::noSuchRequest));
	}

	@Override
	public ResponseEntity<BusinessJobRequest> declineJobRequest(UUID requestId, JobRequestDecline decline) {
		// Optional: no body, no reason and a blank one all decline without one, stored as nothing.
		String reason = decline == null || decline.getReason() == null || decline.getReason().isBlank()
				? null
				: decline.getReason().trim();
		return ResponseEntity.ok(inbox.decline(myBusiness(), requestId, reason)
				.map(InboxController::toWire)
				.orElseThrow(InboxController::noSuchRequest));
	}

	/**
	 * A tradesperson without a business has no inbox rather than an empty one, which is the same
	 * answer the calendar gives them: there is nothing to look at until onboarding step 2.
	 */
	private UUID myBusiness() {
		MarketplaceUser user = currentMarketplaceUser.requireTradesperson();

		return businesses.findIdByOwner(user.id()).orElseThrow(() -> new ResponseStatusException(
				HttpStatus.NOT_FOUND, "No business profile for this account yet, so there is no inbox either"));
	}

	/**
	 * A request belonging to somebody else is not found rather than forbidden. Telling the two
	 * apart would confirm an id to whoever guessed it.
	 */
	private static ResponseStatusException noSuchRequest() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "No such request for this business");
	}

	private static List<AppointmentResolution> resolutions(
			List<com.tradeties.generated.model.AppointmentResolution> wire) {

		if (wire == null) {
			return List.of();
		}

		return wire.stream()
				.map(answer -> new AppointmentResolution(
						answer.getRequestId(),
						AppointmentResolution.Action.valueOf(answer.getAction().getValue()),
						answer.getStartsAt() == null ? null : wallClock(answer.getStartsAt()),
						answer.getEndsAt() == null ? null : wallClock(answer.getEndsAt())))
				.toList();
	}

	private static LocalDateTime wallClock(String value) {
		try {
			return LocalDateTime.parse(value, WALL_CLOCK);
		} catch (DateTimeParseException notOnTheCalendar) {
			throw new InvalidAppointmentException(value + " is not a time on the calendar.");
		}
	}

	private static BusinessJobRequest toWire(BusinessRequest request) {
		BusinessJobRequest wire = new BusinessJobRequest()
				.id(request.id())
				.status(JobRequestStatus.fromValue(request.status().name()))
				.serviceId(request.serviceId())
				.bookedBy(Party.fromValue(request.bookedBy().name()))
				.detailsFrom(Party.fromValue(request.detailsFrom().name()))
				.startsAt(utc(request.startsAt()))
				.endsAt(utc(request.endsAt()))
				.timeZone(request.timeZone())
				.serviceName(request.serviceName())
				.estimatedDurationMinutes(request.estimatedDurationMinutes())
				.customerName(request.customerName())
				.customerEmail(request.customerEmail())
				.customerPhone(request.customerPhone())
				.description(request.description())
				.street1(request.street1())
				.street2(request.street2())
				.city(request.city())
				.state(request.state())
				.postalCode(request.postalCode())
				.currency(request.currency())
				.servicePrice(money(request.servicePrice()))
				.effectiveHourlyRate(money(request.effectiveHourlyRate()))
				.serviceCallFee(money(request.serviceCallFee()))
				.cancellationFee(money(request.cancellationFee()))
				.cancellationNoticeHours(request.cancellationNoticeHours())
				.requestedAt(utc(request.requestedAt()))
				.declineReason(request.declineReason());

		// Absent stays absent rather than becoming a default. "They did not say" is a third state
		// and drawing it as either answer would put words in the customer's mouth.
		if (request.preferredContact() != null) {
			wire.preferredContact(
					com.tradeties.generated.model.ContactMethod.fromValue(request.preferredContact().name()));
		}
		if (request.decidedAt() != null) {
			wire.decidedAt(utc(request.decidedAt()));
		}

		return wire;
	}

	/** Money crosses as a string, because a decimal through a double is a decimal that drifts. */
	private static String money(BigDecimal amount) {
		return amount == null ? null : amount.toPlainString();
	}

	/**
	 * Instants go out at UTC rather than at the business's offset. The zone the reader needs is a
	 * field of its own, and an offset baked into the timestamp is a second copy of it that can
	 * disagree over a daylight saving switch.
	 */
	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}
}
