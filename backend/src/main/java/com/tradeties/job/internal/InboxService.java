package com.tradeties.job.internal;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.availability.BookingRules;
import com.tradeties.availability.CalendarGuard;
import com.tradeties.job.BusinessRequest;
import com.tradeties.job.HourNoLongerFreeException;
import com.tradeties.job.RequestNotPendingException;
import com.tradeties.job.RequestState;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The tradesperson's side of a request: reading them, taking them, turning them down.
 *
 * <p><strong>Accepting is a calendar write and behaves like one.</strong> It takes the lock every
 * other calendar write takes before it reads anything it intends to rely on, because the checks
 * below are only worth making if nothing can change between making them and writing.
 */
@Service
public class InboxService {

	private final JobRequestRepository requests;
	private final BusinessRequestReader reader;
	private final RequestHistory history;
	private final CalendarGuard calendar;

	InboxService(JobRequestRepository requests,
			BusinessRequestReader reader,
			RequestHistory history,
			CalendarGuard calendar) {

		this.requests = requests;
		this.reader = reader;
		this.history = history;
		this.calendar = calendar;
	}

	/**
	 * @param status narrow to one state, or null for everything this business has ever had
	 */
	@Transactional(readOnly = true)
	public List<BusinessRequest> list(UUID businessId, RequestState status) {
		List<JobRequestRow> rows = status == null
				? requests.findByBusinessIdOrderByStartsAtAsc(businessId)
				: requests.findByBusinessIdAndStatusOrderByStartsAtAsc(businessId, RequestStatus.valueOf(status.name()));

		return rows.stream().map(reader::describe).toList();
	}

	/**
	 * Takes the job at the hour it was asked for.
	 *
	 * <p>The order is the substance. The lock comes first, so the working hours, the time off and
	 * the appointments read after it cannot move while they are being checked — the exclusion
	 * constraint alone would catch two overlapping appointments and miss time off entered in
	 * parallel over the same hours.
	 *
	 * <p>What is deliberately <em>not</em> re-checked is the notice and the booking horizon. Those
	 * protect the tradesperson from being booked at short notice or absurdly far ahead, and
	 * somebody accepting has decided for themselves — refusing the acceptance because the notice
	 * has since run out would let the rule act against the person it exists for.
	 *
	 * @throws RequestNotPendingException it has already been decided, withdrawn or cancelled
	 * @throws HourNoLongerFreeException the hour cannot be committed after all
	 */
	@Transactional
	public Optional<BusinessRequest> accept(UUID businessId, UUID requestId) {
		return requests.findByIdAndBusinessId(requestId, businessId).map(request -> {
			requirePending(request);

			BookingRules rules = calendar.lockForWriting(businessId);

			requireNobodyElseHasIt(request, rules);
			requireNotAway(businessId, request);
			requireDayHasRoom(businessId, request, rules);

			request.accept(Instant.now());
			history.record(request, RequestStatus.PENDING, Actor.BUSINESS, null);
			return reader.describe(requests.save(request));
		});
	}

	@Transactional
	public Optional<BusinessRequest> decline(UUID businessId, UUID requestId, String reason) {
		return requests.findByIdAndBusinessId(requestId, businessId).map(request -> {
			requirePending(request);

			// No lock and no checks. Declining commits no calendar, so it cannot collide with
			// anything the calendar's mutex protects.
			request.decline(Instant.now(), reason);
			history.record(request, RequestStatus.PENDING, Actor.BUSINESS, null);
			return reader.describe(requests.save(request));
		});
	}

	private static void requirePending(JobRequestRow request) {
		if (!request.isPending()) {
			throw new RequestNotPendingException(
					"This request is " + request.status().name().toLowerCase() + " and cannot be answered again");
		}
	}

	/**
	 * Accepted appointments, widened by the travel time the business keeps between jobs.
	 *
	 * <p>The buffer is why this is checked here and not left to the exclusion constraint. That
	 * constraint catches spans that genuinely overlap; two jobs forty minutes apart with an hour
	 * of driving between them do not overlap and still cannot both be worked.
	 */
	private void requireNobodyElseHasIt(JobRequestRow request, BookingRules rules) {
		long buffer = rules.appointmentBufferMinutes();

		boolean taken = !requests.findByBusinessIdAndStatusAndEndsAtAfterAndStartsAtBefore(
				request.businessId(),
				RequestStatus.ACCEPTED,
				request.startsAt().minus(buffer, ChronoUnit.MINUTES),
				request.endsAt().plus(buffer, ChronoUnit.MINUTES)).isEmpty();

		if (taken) {
			throw new HourNoLongerFreeException(
					"Another appointment already holds that time, or leaves too little travel time around it");
		}
	}

	private void requireNotAway(UUID businessId, JobRequestRow request) {
		if (calendar.isAway(businessId, request.startsAt(), request.endsAt())) {
			throw new HourNoLongerFreeException("Time off now covers that appointment");
		}
	}

	/**
	 * The limit is a statement about the business's own day, so the day is measured in their zone.
	 * Over UTC the boundary lands seven hours into a Denver afternoon, and an evening job would be
	 * counted against the wrong day.
	 */
	private void requireDayHasRoom(UUID businessId, JobRequestRow request, BookingRules rules) {
		Integer most = rules.maxAcceptedAppointmentsPerDay();
		if (most == null) {
			return;
		}

		ZoneId zone = ZoneId.of(reader.jobFor(request).timeZone());
		LocalDate day = LocalDate.ofInstant(request.startsAt(), zone);

		int already = requests.countByBusinessIdAndStatusAndStartsAtGreaterThanEqualAndStartsAtLessThan(
				businessId, RequestStatus.ACCEPTED,
				day.atStartOfDay(zone).toInstant(),
				day.plusDays(1).atStartOfDay(zone).toInstant());

		if (already >= most) {
			throw new HourNoLongerFreeException(
					"That day already holds the " + most + " appointments this business accepts");
		}
	}
}
