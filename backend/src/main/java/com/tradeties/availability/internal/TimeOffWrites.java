package com.tradeties.availability.internal;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.tradeties.availability.InvalidTimeOffException;
import com.tradeties.availability.RequestInTheWay;
import com.tradeties.availability.RequestsInTheWay;
import com.tradeties.availability.StaleCalendarException;
import com.tradeties.availability.TimeOffAnswers;
import com.tradeties.availability.TimeOffAnswers.Resolution;
import com.tradeties.availability.TimeOffConflictException;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The write paths of time off, each behind the calendar lock like those in {@link CalendarWrites}.
 * Every method assumes the policy row exists and takes it {@code FOR UPDATE} first: accepting a
 * request reads time off under the same lock, and an entry saved beside it unlocked would let an
 * appointment land in a holiday.
 */
@Component
class TimeOffWrites {

	private final BookingPolicyRepository policies;
	private final TimeOffRepository absences;
	private final RequestsInTheWay requests;

	TimeOffWrites(BookingPolicyRepository policies, TimeOffRepository absences, RequestsInTheWay requests) {
		this.policies = policies;
		this.absences = absences;
		this.requests = requests;
	}

	@Transactional
	TimeOffRow add(UUID businessId, UUID userId, TimeOffSpan span, boolean allDay, String note,
			TimeOffAnswers answers) {

		lock(businessId);
		requireNotOver(span);

		return store(new TimeOffRow(businessId, userId), span, allDay, note,
				requests.overlapping(businessId, span.startsAt(), span.endsAt()), answers);
	}

	/**
	 * Only what the new span covers and the old one did not is put to the business again — the
	 * rest was answered when the entry was made.
	 */
	@Transactional
	Optional<TimeOffRow> replace(UUID businessId, UUID timeOffId, long expectedVersion, TimeOffSpan span,
			boolean allDay, String note, TimeOffAnswers answers) {

		lock(businessId);

		return absences.findByIdAndBusinessId(timeOffId, businessId).map(row -> {
			if (row.version() != expectedVersion) {
				throw new StaleCalendarException(
						"This time off changed since you loaded it. Reload and make your change again.");
			}
			requireNotOver(span);

			Set<UUID> answeredBefore = requests.overlapping(businessId, row.startsAt(), row.endsAt()).stream()
					.map(RequestInTheWay::requestId)
					.collect(Collectors.toSet());

			List<RequestInTheWay> newlyInTheWay = requests.overlapping(businessId, span.startsAt(), span.endsAt())
					.stream()
					.filter(request -> !answeredBefore.contains(request.requestId()))
					.toList();

			return store(row, span, allDay, note, newlyInTheWay, answers);
		});
	}

	/** Requests declined when the entry was made stay declined: removing it frees time, it undoes nothing. */
	@Transactional
	boolean remove(UUID businessId, UUID timeOffId) {
		lock(businessId);

		return absences.findByIdAndBusinessId(timeOffId, businessId)
				.map(row -> {
					absences.delete(row);
					return true;
				})
				.orElse(false);
	}

	private TimeOffRow store(TimeOffRow row, TimeOffSpan span, boolean allDay, String note,
			List<RequestInTheWay> inTheWay, TimeOffAnswers answers) {

		requireAnswered(inTheWay, answers);

		List<UUID> declined = inTheWay.stream()
				.filter(request -> !request.accepted())
				.map(RequestInTheWay::requestId)
				.filter(id -> answers.resolutions().get(id) == Resolution.DECLINE)
				.toList();

		if (!declined.isEmpty() && (answers.declineReason() == null || answers.declineReason().isBlank())) {
			throw new InvalidTimeOffException("Say what the customers you turn down are given as the reason.");
		}

		row.cover(span.startsAt(), span.endsAt(), allDay, note);
		if (inTheWay.stream().anyMatch(RequestInTheWay::accepted)) {
			row.confirmOverride(Instant.now());
		}
		TimeOffRow stored = absences.saveAndFlush(row);

		if (!declined.isEmpty()) {
			requests.decline(stored.businessId(), declined, answers.declineReason().trim(),
					"Declined while entering time off " + stored.id());
		}

		return stored;
	}

	/**
	 * Every request in the way needs an answer, and an accepted one only takes {@code KEEP}: a
	 * business cancellation is not offered from here. The whole list goes back, answered or not.
	 */
	private static void requireAnswered(List<RequestInTheWay> inTheWay, TimeOffAnswers answers) {
		boolean unanswered = inTheWay.stream().anyMatch(request -> {
			Resolution answer = answers.resolutions().get(request.requestId());
			return answer == null || (request.accepted() && answer == Resolution.DECLINE);
		});

		if (unanswered) {
			throw new TimeOffConflictException(inTheWay);
		}
	}

	private static void requireNotOver(TimeOffSpan span) {
		if (!span.endsAt().isAfter(Instant.now())) {
			throw new InvalidTimeOffException("That time is already over, so there is nothing left to take off the calendar.");
		}
	}

	private void lock(UUID businessId) {
		policies.lockByBusinessId(businessId).orElseThrow(() -> new IllegalStateException(
				"No booking policy for business " + businessId + " — provisioning did not run"));
	}
}
