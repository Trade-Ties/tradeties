package com.tradeties.availability;

import java.net.URI;
import java.time.ZoneOffset;

import com.tradeties.generated.model.JobRequestStatus;
import com.tradeties.generated.model.TimeOffConflict;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Scoped to {@link AvailabilityController} rather than registered globally: a shared handler
 * would have to import every module's exceptions and would grow a dependency on each.
 */
@RestControllerAdvice(assignableTypes = AvailabilityController.class)
class AvailabilityExceptionHandler {

	private static final URI TIME_OFF_CONFLICTS = URI.create("urn:tradeties:problem:time-off-conflicts");

	/** 400 rather than 409: nothing raced, the submitted week was never valid. */
	@ExceptionHandler(InvalidWorkingWeekException.class)
	ProblemDetail handleInvalidWeek(InvalidWorkingWeekException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setTitle("Invalid working week");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	@ExceptionHandler(InvalidTimeOffException.class)
	ProblemDetail handleInvalidTimeOff(InvalidTimeOffException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setTitle("Invalid time off");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/** Typed, because the client answers it with a dialog and a resend rather than a sentence. */
	@ExceptionHandler(TimeOffConflictException.class)
	ProblemDetail handleTimeOffConflicts(TimeOffConflictException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setType(TIME_OFF_CONFLICTS);
		problem.setTitle("Requests in the way");
		problem.setDetail(exception.getMessage());
		problem.setProperty("conflicts", exception.inTheWay().stream()
				.map(AvailabilityExceptionHandler::toWire)
				.toList());
		return problem;
	}

	@ExceptionHandler(StaleCalendarException.class)
	ProblemDetail handleStale(StaleCalendarException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setTitle("Conflict");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/**
	 * Hibernate's own version check, for a row another write changed in the same moment. The detail
	 * is fixed rather than taken from the exception, whose message names the entity class and the
	 * row id — not the client's business.
	 */
	@ExceptionHandler(OptimisticLockingFailureException.class)
	ProblemDetail handleConcurrentWrite(OptimisticLockingFailureException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setTitle("Conflict");
		problem.setDetail("Your calendar changed at the same moment. Reload and try again.");
		return problem;
	}

	private static TimeOffConflict toWire(RequestInTheWay request) {
		return new TimeOffConflict()
				.requestId(request.requestId())
				.status(request.accepted() ? JobRequestStatus.ACCEPTED : JobRequestStatus.PENDING)
				.startsAt(request.startsAt().atOffset(ZoneOffset.UTC))
				.endsAt(request.endsAt().atOffset(ZoneOffset.UTC))
				.timeZone(request.timeZone())
				.customerName(request.customerName())
				.serviceName(request.serviceName());
	}
}
