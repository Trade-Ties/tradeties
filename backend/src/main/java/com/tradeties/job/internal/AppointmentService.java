package com.tradeties.job.internal;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.tradeties.availability.CalendarGuard;
import com.tradeties.business.BookableService;
import com.tradeties.business.BookableServices;
import com.tradeties.business.GeoPoint;
import com.tradeties.business.PostalAddress;
import com.tradeties.business.SiteLocations;
import com.tradeties.job.AppointmentConflictException;
import com.tradeties.job.AppointmentDetails;
import com.tradeties.job.AppointmentInTheWay;
import com.tradeties.job.AppointmentResolution;
import com.tradeties.job.BookingParty;
import com.tradeties.job.BusinessRequest;
import com.tradeties.job.HourNoLongerFreeException;
import com.tradeties.job.InvalidAppointmentException;
import com.tradeties.job.NewAppointment;
import com.tradeties.job.NotAnAcceptedAppointmentException;
import com.tradeties.job.RequestNotPendingException;
import com.tradeties.job.ServiceNotOfferedException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Appointments the business arranges itself: booking a customer who phoned or a regular, a time
 * agreed in place of the one a customer asked for, and moving or removing any accepted appointment.
 *
 * <p><strong>Only the hard rules apply</strong> — nothing in time off, and no two appointments at
 * once — checked under the calendar lock like an acceptance. The buffer, the daily limit, the
 * notice and the horizon protect the business from the marketplace; applying them here would let
 * its own rules refuse a time it chose itself.
 */
@Service
public class AppointmentService {

	/** Aimed at a mistyped date, not at a long job: an appointment is one visit. */
	private static final Duration LONGEST = Duration.ofHours(24);

	private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("EEE, MMM d 'at' h:mm a", Locale.US);

	private final BookableServices bookable;
	private final SiteLocations locations;
	private final CalendarGuard calendar;
	private final JobRepository jobs;
	private final JobRequestRepository requests;
	private final BusinessRequestReader reader;
	private final RequestHistory history;

	AppointmentService(BookableServices bookable,
			SiteLocations locations,
			CalendarGuard calendar,
			JobRepository jobs,
			JobRequestRepository requests,
			BusinessRequestReader reader,
			RequestHistory history) {

		this.bookable = bookable;
		this.locations = locations;
		this.calendar = calendar;
		this.jobs = jobs;
		this.requests = requests;
		this.reader = reader;
		this.history = history;
	}

	/**
	 * @return empty when {@code replacesRequestId} names no request of this business
	 * @throws ServiceNotOfferedException the service is not this business's, not active, or has no terms to copy
	 * @throws RequestNotPendingException the request to replace was answered in the meantime
	 * @throws AppointmentConflictException accepted appointments are in the way and not all answered
	 * @throws HourNoLongerFreeException time off covers the time, or a time something was moved to is taken
	 */
	@Transactional
	public Optional<BusinessRequest> book(UUID businessId, NewAppointment appointment) {
		BookableService offered = bookable.findOwn(businessId, appointment.serviceId())
				.orElseThrow(() -> new ServiceNotOfferedException(
						"That service can't be booked. Check that it is active and that your pricing is set."));

		ZoneId zone = ZoneId.of(offered.timeZone());
		AppointmentDetails details = appointment.details();
		Span span = spanOf(details.startsAt(), details.endsAt(), zone);

		if (appointment.replacesRequestId() == null) {
			requireNamed(details);
			makeRoom(businessId, null, span, appointment.resolutions());

			JobRow job = jobs.save(new JobRow(details, offered.tradeId(), offered.timeZone(), locate(details)));
			return Optional.of(accepted(job, offered, span));
		}

		return requests.findByIdAndBusinessId(appointment.replacesRequestId(), businessId).map(replaced -> {
			if (!replaced.isPending()) {
				throw new RequestNotPendingException(
						"That request was answered in the meantime, so there is nothing left to replace.");
			}
			makeRoom(businessId, null, span, appointment.resolutions());

			replaced.decline(Instant.now(),
					"Moved to " + WHEN.format(span.startsAt().atZone(zone)) + ", as agreed with you.");
			// Flushed before the new one is written: a job holds one live request per business.
			requests.saveAndFlush(replaced);
			history.record(replaced, RequestStatus.PENDING, Actor.BUSINESS,
					"Replaced by an appointment the business booked");

			return accepted(reader.jobFor(replaced), offered, span);
		});
	}

	/**
	 * Any accepted appointment, whoever booked it. The time always; the customer's details only on
	 * a job the business entered — on one the customer sent they are the customer's own words, and
	 * the job is the same row every business they asked reads.
	 *
	 * @return empty when this business has no such request
	 * @throws NotAnAcceptedAppointmentException still pending, or no longer standing
	 */
	@Transactional
	public Optional<BusinessRequest> change(UUID businessId, UUID requestId, AppointmentDetails details,
			List<AppointmentResolution> resolutions) {

		return requests.findByIdAndBusinessId(requestId, businessId).map(request -> {
			requireAccepted(request);

			JobRow job = reader.jobFor(request);
			ZoneId zone = ZoneId.of(job.timeZone());
			boolean detailsAreTheBusinesss = job.createdBy() == BookingParty.BUSINESS;
			Span span = spanOf(details.startsAt(), details.endsAt(), zone);
			if (detailsAreTheBusinesss) {
				requireNamed(details);
			}

			makeRoom(businessId, request.id(), span, resolutions);

			move(request, span, zone);
			if (detailsAreTheBusinesss) {
				job.correct(details, locate(details));
			}

			return reader.describe(requests.saveAndFlush(request));
		});
	}

	/**
	 * Any accepted appointment, recorded as cancelled by the business and never deleted. No lock:
	 * freeing time cannot collide with anything the calendar's mutex protects.
	 *
	 * @return false when this business has no such request
	 */
	@Transactional
	public boolean remove(UUID businessId, UUID requestId) {
		return requests.findByIdAndBusinessId(requestId, businessId)
				.map(request -> {
					requireAccepted(request);

					request.cancelByBusiness(Instant.now());
					requests.save(request);
					history.record(request, RequestStatus.ACCEPTED, Actor.BUSINESS, null);
					return true;
				})
				.orElse(false);
	}

	/**
	 * Takes the calendar lock and clears the way for {@code wanted}, moving or cancelling what is
	 * in it as the business answered.
	 *
	 * <p><strong>The end state is checked before anything is written</strong>, and then the overlap
	 * constraint is deferred: two appointments trading places overlap between their two updates,
	 * and checked per statement a valid rearrangement would fail halfway.
	 *
	 * @param moving the appointment being moved to {@code wanted}, whose old time is free; null when booking
	 */
	private void makeRoom(UUID businessId, UUID moving, Span wanted, List<AppointmentResolution> resolutions) {
		calendar.lockForWriting(businessId);

		if (calendar.isAway(businessId, wanted.startsAt(), wanted.endsAt())) {
			throw new HourNoLongerFreeException("Your time off covers that time. Shorten or remove it first.");
		}

		List<JobRequestRow> inTheWay = acceptedWithin(businessId, wanted).stream()
				.filter(other -> !other.id().equals(moving))
				.toList();
		if (inTheWay.isEmpty()) {
			return;
		}

		Map<UUID, AppointmentResolution> answers = resolutions.stream().collect(Collectors.toMap(
				AppointmentResolution::requestId, answer -> answer, (first, second) -> second));

		if (inTheWay.stream().anyMatch(row -> !answers.containsKey(row.id()))) {
			throw new AppointmentConflictException(inTheWay.stream().map(this::describeInTheWay).toList());
		}

		Map<JobRequestRow, Span> moves = new LinkedHashMap<>();
		for (JobRequestRow row : inTheWay) {
			AppointmentResolution answer = answers.get(row.id());
			if (answer.action() == AppointmentResolution.Action.MOVE) {
				if (answer.startsAt() == null || answer.endsAt() == null) {
					throw new InvalidAppointmentException("Say where " + customerOf(row) + "'s appointment moves to.");
				}
				moves.put(row, spanOf(answer.startsAt(), answer.endsAt(), ZoneId.of(reader.jobFor(row).timeZone())));
			}
		}

		requireRoomFor(businessId, moving, wanted, inTheWay, moves);

		requests.deferOverlapCheck();

		Instant now = Instant.now();
		for (JobRequestRow row : inTheWay) {
			if (answers.get(row.id()).action() == AppointmentResolution.Action.CANCEL) {
				row.cancelByBusiness(now);
				history.record(row, RequestStatus.ACCEPTED, Actor.BUSINESS,
						"Cancelled to make room for another appointment");
			}
		}
		moves.forEach((row, span) -> move(row, span, ZoneId.of(reader.jobFor(row).timeZone())));
	}

	/**
	 * Every moved appointment against time off, against the new time, against each other, and
	 * against everything that stays where it is. Old times of anything being rearranged are free.
	 */
	private void requireRoomFor(UUID businessId, UUID moving, Span wanted, List<JobRequestRow> inTheWay,
			Map<JobRequestRow, Span> moves) {

		Set<UUID> rearranged = new HashSet<>();
		inTheWay.forEach(row -> rearranged.add(row.id()));
		if (moving != null) {
			rearranged.add(moving);
		}

		List<Span> placed = new ArrayList<>();
		placed.add(wanted);

		for (Map.Entry<JobRequestRow, Span> move : moves.entrySet()) {
			String customer = customerOf(move.getKey());
			Span span = move.getValue();

			if (calendar.isAway(businessId, span.startsAt(), span.endsAt())) {
				throw new HourNoLongerFreeException("Your time off covers the time you picked for " + customer + ".");
			}
			if (placed.stream().anyMatch(span::overlaps)) {
				throw new HourNoLongerFreeException(
						"The time you picked for " + customer + " overlaps another appointment you are placing.");
			}
			if (acceptedWithin(businessId, span).stream().anyMatch(other -> !rearranged.contains(other.id()))) {
				throw new HourNoLongerFreeException(
						"The time you picked for " + customer + " is taken by another appointment.");
			}

			placed.add(span);
		}
	}

	/** Recorded when the time changes, so who moved an appointment — and from when — is on file. */
	private void move(JobRequestRow row, Span span, ZoneId zone) {
		if (row.startsAt().equals(span.startsAt()) && row.endsAt().equals(span.endsAt())) {
			return;
		}

		String note = "Moved from " + WHEN.format(row.startsAt().atZone(zone))
				+ " to " + WHEN.format(span.startsAt().atZone(zone));
		row.reschedule(span.startsAt(), span.endsAt());
		history.record(row, RequestStatus.ACCEPTED, Actor.BUSINESS, note);
	}

	private BusinessRequest accepted(JobRow job, BookableService offered, Span span) {
		JobRequestRow booked = requests.save(JobRequestRow.bookedByBusiness(
				job.id(), span.startsAt(), span.endsAt(), offered, Instant.now()));
		history.record(booked, null, Actor.BUSINESS, null);

		return reader.describe(booked);
	}

	private List<JobRequestRow> acceptedWithin(UUID businessId, Span span) {
		return requests.findByBusinessIdAndStatusAndEndsAtAfterAndStartsAtBefore(
				businessId, RequestStatus.ACCEPTED, span.startsAt(), span.endsAt());
	}

	private AppointmentInTheWay describeInTheWay(JobRequestRow row) {
		JobRow job = reader.jobFor(row);
		return new AppointmentInTheWay(row.id(), row.bookedBy(), row.startsAt(), row.endsAt(), job.timeZone(),
				job.customerName(), row.serviceName());
	}

	private String customerOf(JobRequestRow row) {
		return reader.jobFor(row).customerName();
	}

	private static void requireAccepted(JobRequestRow request) {
		if (!request.isAccepted()) {
			throw new NotAnAcceptedAppointmentException(request.isPending()
					? "This request is still waiting for your answer. Accept or decline it instead."
					: "This appointment no longer stands, so there is nothing to move or remove.");
		}
	}

	private static void requireNamed(AppointmentDetails details) {
		if (details.customerName() == null || details.customerName().isBlank()) {
			throw new InvalidAppointmentException("Say who the appointment is for.");
		}
	}

	private static Span spanOf(LocalDateTime startsAtLocal, LocalDateTime endsAtLocal, ZoneId zone) {
		Instant startsAt = startsAtLocal.atZone(zone).toInstant();
		Instant endsAt = endsAtLocal.atZone(zone).toInstant();

		if (!endsAt.isAfter(startsAt)) {
			throw new InvalidAppointmentException("The end has to be after the start.");
		}
		if (Duration.between(startsAt, endsAt).compareTo(LONGEST) > 0) {
			throw new InvalidAppointmentException("An appointment lasts a day at most.");
		}
		if (!endsAt.isAfter(Instant.now())) {
			throw new InvalidAppointmentException("That time is already over.");
		}

		return new Span(startsAt, endsAt);
	}

	private GeoPoint locate(AppointmentDetails details) {
		if (details.postalCode() == null || details.postalCode().isBlank()) {
			return null;
		}

		return locations.locate(new PostalAddress(details.street1(), null, details.city(), details.state(),
				details.postalCode())).orElse(null);
	}

	/** Half-open like every span in this calendar: 10:00–11:00 and 11:00–12:00 do not overlap. */
	private record Span(Instant startsAt, Instant endsAt) {

		boolean overlaps(Span other) {
			return startsAt.isBefore(other.endsAt) && other.startsAt.isBefore(endsAt);
		}
	}
}
