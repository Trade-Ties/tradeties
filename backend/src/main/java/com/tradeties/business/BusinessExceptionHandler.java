package com.tradeties.business;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Scoped to {@code business} rather than registered globally: a shared handler would end up
 * importing every module's exceptions.
 *
 * <p>404 and 403 are absent on purpose. Those are decisions the controller makes about a request,
 * not conditions the domain reports, so they are thrown there as {@code ResponseStatusException}
 * and need no translation.
 */
@RestControllerAdvice(assignableTypes = BusinessController.class)
class BusinessExceptionHandler {

	/**
	 * A {@code type} of its own, because this 409 is answered by asking the tradesperson and sending
	 * the request again rather than by showing the message. A client matching on {@code detail}
	 * instead would break the first time somebody reworded a sentence written for people.
	 *
	 * <p>A URN rather than an https URL, because nothing is served at the other end.
	 */
	private static final URI UNCONFIRMED_TIME_ZONE_CHANGE =
			URI.create("urn:tradeties:problem:unconfirmed-time-zone-change");

	/**
	 * A {@code type} of its own for the same reason {@link #UNCONFIRMED_TIME_ZONE_CHANGE} has one:
	 * the client answers this by asking a question and sending the request again.
	 */
	private static final URI UNCONFIRMED_UNPUBLISH =
			URI.create("urn:tradeties:problem:unconfirmed-unpublish");

	private static final URI SLUG_LOCKED = URI.create("urn:tradeties:problem:slug-locked");

	/**
	 * Where a published profile lives, for the one message that has to name the whole address.
	 *
	 * <p>Configured rather than compiled into the domain: which host serves a profile is a
	 * deployment's answer — staging, a rename, a per-environment domain. Here because this class is
	 * the edge where a domain refusal becomes something written for a client. The wizard keeps its
	 * own copy for composing links, which is the one thing these two cannot share.
	 */
	private final String profileUrlPrefix;

	BusinessExceptionHandler(
			@Value("${tradeties.profile-url-prefix}") String profileUrlPrefix) {
		this.profileUrlPrefix = profileUrlPrefix;
	}

	@ExceptionHandler(BusinessAlreadyExistsException.class)
	ProblemDetail handleAlreadyExists(BusinessAlreadyExistsException exception) {
		return conflict(exception.getMessage());
	}

	@ExceptionHandler(SlugTakenException.class)
	ProblemDetail handleSlugTaken(SlugTakenException exception) {
		return conflict(exception.getMessage());
	}

	/**
	 * A {@code type} of its own, because there is something for the client to do about it.
	 *
	 * <p>Reaching here means the client's {@code slugLocked} is stale — a second tab published
	 * while this one was open. Told only in prose it cannot learn that, so it goes on holding the
	 * refused slug and every later save of steps 1 and 2 is refused identically. Told by
	 * {@code type}, it re-reads the profile and puts the stored URL back.
	 *
	 * <p>The stored slug stays in the sentence rather than becoming an extension member: the
	 * message has to read on its own for any client, and the wizard has the value from the re-read.
	 */
	@ExceptionHandler(SlugLockedException.class)
	ProblemDetail handleSlugLocked(SlugLockedException exception) {
		ProblemDetail problem = conflict("Your profile URL was fixed when you published. "
				+ profileUrlPrefix + exception.storedSlug()
				+ " is the address your customers have, so it cannot be changed here.");
		problem.setTitle("Profile URL is fixed");
		problem.setType(SLUG_LOCKED);
		return problem;
	}

	/**
	 * A version conflict this module raised itself, so the message is one written here and goes out
	 * as it stands. That is the difference from {@link #handleConcurrentWrite}, and the reason
	 * {@link StaleVersionException} exists: this module raises version conflicts about five
	 * different things, and one shared sentence fits only one of them.
	 */
	@ExceptionHandler(StaleVersionException.class)
	ProblemDetail handleStaleVersion(StaleVersionException exception) {
		return conflict(exception.getMessage());
	}

	/**
	 * Hibernate's own, from a genuine concurrent flush rather than from a version the client sent.
	 * The message is deliberately <em>not</em> passed on: it names the entity class and the row id,
	 * and neither is the client's business.
	 */
	@ExceptionHandler(OptimisticLockingFailureException.class)
	ProblemDetail handleConcurrentWrite(OptimisticLockingFailureException exception) {
		return conflict("Something else changed this while you were editing. "
				+ "Reload and apply your edit again.");
	}

	@ExceptionHandler(ServiceNameTakenException.class)
	ProblemDetail handleServiceNameTaken(ServiceNameTakenException exception) {
		return conflict(exception.getMessage());
	}

	@ExceptionHandler(LicenseAlreadyExistsException.class)
	ProblemDetail handleLicenseAlreadyExists(LicenseAlreadyExistsException exception) {
		return conflict(exception.getMessage());
	}

	@ExceptionHandler(InvalidSelectionException.class)
	ProblemDetail handleInvalidSelection(InvalidSelectionException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setTitle("Invalid selection");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/**
	 * Deliberately not folded into the handler above: an amount that cannot be a price is not a
	 * selection that does not exist, and "Invalid selection" is what the reader would otherwise be
	 * told about their own hourly rate.
	 */
	@ExceptionHandler(ImplausibleAmountException.class)
	ProblemDetail handleImplausibleAmount(ImplausibleAmountException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setTitle("Implausible amount");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	@ExceptionHandler(UnconfirmedTimeZoneChangeException.class)
	ProblemDetail handleUnconfirmedTimeZoneChange(UnconfirmedTimeZoneChangeException exception) {
		ProblemDetail problem = conflict(exception.getMessage());
		problem.setTitle("Unconfirmed time zone change");
		problem.setType(UNCONFIRMED_TIME_ZONE_CHANGE);
		return problem;
	}

	@ExceptionHandler(UnconfirmedUnpublishException.class)
	ProblemDetail handleUnconfirmedUnpublish(UnconfirmedUnpublishException exception) {
		ProblemDetail problem = conflict(exception.getMessage());
		problem.setTitle("Unconfirmed unpublish");
		problem.setType(UNCONFIRMED_UNPUBLISH);
		return problem;
	}

	@ExceptionHandler(ProfileSuspendedException.class)
	ProblemDetail handleSuspended(ProfileSuspendedException exception) {
		return conflict(exception.getMessage());
	}

	/**
	 * A conflict rather than the 422 below, although both are about the checklist. This one
	 * refuses a write that was not asking to publish, and the whole answer is the sentence — see
	 * {@link LiveProfileNotReadyException} for why the two are not one exception.
	 */
	@ExceptionHandler(LiveProfileNotReadyException.class)
	ProblemDetail handleLiveProfileNotReady(LiveProfileNotReadyException exception) {
		return conflict(exception.getMessage());
	}

	/**
	 * 422 with the checklist as the body, not a problem detail: the client has to show the same list
	 * it would have shown from {@code GET /readiness}, and deriving it back out of a prose message
	 * would be a second implementation of the rules — the one that goes stale.
	 */
	@ExceptionHandler(ProfileNotReadyException.class)
	ResponseEntity<com.tradeties.generated.model.ProfileReadiness> handleNotReady(
			ProfileNotReadyException exception) {

		return ResponseEntity.unprocessableEntity()
				.body(BusinessController.toWire(exception.readiness()));
	}

	private static ProblemDetail conflict(String detail) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setTitle("Conflict");
		problem.setDetail(detail);
		return problem;
	}
}
