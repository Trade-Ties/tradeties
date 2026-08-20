package com.tradeties.availability;

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

	/** 400 rather than 409: nothing raced, the submitted week was never valid. */
	@ExceptionHandler(InvalidWorkingWeekException.class)
	ProblemDetail handleInvalidWeek(InvalidWorkingWeekException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
		problem.setTitle("Invalid working week");
		problem.setDetail(exception.getMessage());
		return problem;
	}

	/**
	 * The detail is fixed rather than taken from the exception, because Hibernate's own message
	 * names the entity class and the row id — not the client's business.
	 *
	 * <p>Correct only while the booking policy is this module's one versioned resource.
	 * {@code availability_time_off} already carries a version column in V4, so once time off can be
	 * written this sentence becomes a lie about half the conflicts arriving here. Replace it then
	 * with a module exception raised at the throw site, the shape {@code business} already has in
	 * {@code StaleVersionException}.
	 */
	@ExceptionHandler(OptimisticLockingFailureException.class)
	ProblemDetail handleStaleVersion(OptimisticLockingFailureException exception) {
		ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
		problem.setTitle("Conflict");
		problem.setDetail("The booking rules changed since you loaded them. Reload and apply your edit again.");
		return problem;
	}
}
