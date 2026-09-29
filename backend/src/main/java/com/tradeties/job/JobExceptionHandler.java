package com.tradeties.job;

import java.net.URI;
import java.time.ZoneOffset;

import com.tradeties.generated.model.AppointmentConflict;
import com.tradeties.generated.model.Party;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Scoped to this module's two controllers, like every other handler here: a shared one would have
 * to import each module's exceptions and grow a dependency on all of them.
 *
 * <p>Both of them, because the two halves of one request raise the same vocabulary from the same
 * rows — and a sentence about an hour that is no longer free should not read two ways depending
 * on which door it came through.
 */
@RestControllerAdvice(assignableTypes = { JobController.class, InboxController.class })
class JobExceptionHandler {

	/**
	 * The same type the availability operation answers an unoffered service with, deliberately.
	 * A client meeting it on either endpoint does the same thing — re-read the profile — and two
	 * types for one remedy would just be two branches saying the same sentence.
	 */
	private static final URI INVALID_SELECTION = URI.create("urn:tradeties:problem:invalid-selection");

	/**
	 * A type of its own because the remedy differs from the one above: not "choose again from the
	 * profile" but "read the calendar again". A client that could not tell them apart would send
	 * somebody back to the service list when what moved was the time.
	 */
	private static final URI SLOT_NOT_OFFERED = URI.create("urn:tradeties:problem:slot-not-offered");

	private static final URI APPOINTMENT_CONFLICTS = URI.create("urn:tradeties:problem:appointment-conflicts");

	/**
	 * 404 rather than 400. The slug is the address, and a slug nobody holds is a page that does
	 * not exist — the same answer the profile gives, for the same reason: a draft, a suspension
	 * and a typo must not be distinguishable from outside.
	 */
	@ExceptionHandler(NoSuchBusinessException.class)
	ProblemDetail handleNoSuchBusiness(NoSuchBusinessException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
		problem.setTitle("No such business");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	@ExceptionHandler(ServiceNotOfferedException.class)
	ProblemDetail handleServiceNotOffered(ServiceNotOfferedException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setType(INVALID_SELECTION);
		problem.setTitle("Service not offered");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	@ExceptionHandler(SlotNotOfferedException.class)
	ProblemDetail handleSlotNotOffered(SlotNotOfferedException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setType(SLOT_NOT_OFFERED);
		problem.setTitle("Time no longer available");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/**
	 * 409, because trying again could genuinely answer differently: the appointment in the way may
	 * itself be cancelled, or the time off withdrawn. That is the whole difference from the 422
	 * below.
	 */
	@ExceptionHandler(HourNoLongerFreeException.class)
	ProblemDetail handleHourTaken(HourNoLongerFreeException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setTitle("That hour is no longer free");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/** 422: the request's story is over, and no retry reopens it. */
	@ExceptionHandler(RequestNotPendingException.class)
	ProblemDetail handleNotPending(RequestNotPendingException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.UNPROCESSABLE_ENTITY);
		problem.setTitle("Already answered");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	@ExceptionHandler(NotAnAcceptedAppointmentException.class)
	ProblemDetail handleNotAccepted(NotAnAcceptedAppointmentException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.UNPROCESSABLE_ENTITY);
		problem.setTitle("Not an accepted appointment");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/** Typed, because the client answers it with a dialog and a resend rather than a sentence. */
	@ExceptionHandler(AppointmentConflictException.class)
	ProblemDetail handleAppointmentConflicts(AppointmentConflictException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setType(APPOINTMENT_CONFLICTS);
		problem.setTitle("Appointments in the way");
		problem.setDetail(exception.getMessage());
		problem.setProperty("conflicts", exception.inTheWay().stream()
				.map(appointment -> new AppointmentConflict()
						.requestId(appointment.requestId())
						.bookedBy(Party.fromValue(appointment.bookedBy().name()))
						.startsAt(appointment.startsAt().atOffset(ZoneOffset.UTC))
						.endsAt(appointment.endsAt().atOffset(ZoneOffset.UTC))
						.timeZone(appointment.timeZone())
						.customerName(appointment.customerName())
						.serviceName(appointment.serviceName()))
				.toList());
		return problem;
	}

	@ExceptionHandler(InvalidAppointmentException.class)
	ProblemDetail handleInvalidAppointment(InvalidAppointmentException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setTitle("Invalid appointment");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/**
	 * Two writes to one request in the same moment — a second tab, a double click. The detail is
	 * fixed because Hibernate's own names the entity class and the row id.
	 */
	@ExceptionHandler(OptimisticLockingFailureException.class)
	ProblemDetail handleConcurrentWrite(OptimisticLockingFailureException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setTitle("Conflict");
		problem.setDetail("This changed at the same moment somewhere else. Reload to see where it stands.");
		return problem;
	}
}
