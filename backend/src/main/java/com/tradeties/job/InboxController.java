package com.tradeties.job;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.tradeties.business.Businesses;
import com.tradeties.generated.api.InboxApi;
import com.tradeties.generated.model.BusinessJobRequest;
import com.tradeties.generated.model.JobRequestDecline;
import com.tradeties.generated.model.JobRequestStatus;
import com.tradeties.identity.CurrentMarketplaceUser;
import com.tradeties.identity.MarketplaceUser;
import com.tradeties.job.internal.InboxService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The tradesperson's side of the requests customers send.
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

	private final CurrentMarketplaceUser currentMarketplaceUser;
	private final Businesses businesses;
	private final InboxService inbox;

	InboxController(CurrentMarketplaceUser currentMarketplaceUser,
			Businesses businesses,
			InboxService inbox) {

		this.currentMarketplaceUser = currentMarketplaceUser;
		this.businesses = businesses;
		this.inbox = inbox;
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
		return ResponseEntity.ok(inbox.decline(myBusiness(), requestId, decline.getReason())
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

	private static BusinessJobRequest toWire(BusinessRequest request) {
		BusinessJobRequest wire = new BusinessJobRequest()
				.id(request.id())
				.status(JobRequestStatus.fromValue(request.status().name()))
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
