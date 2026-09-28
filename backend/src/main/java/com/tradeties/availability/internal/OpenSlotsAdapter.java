package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import com.tradeties.availability.AcceptedAppointments;
import com.tradeties.availability.BookingRules;
import com.tradeties.availability.HoursBlock;
import com.tradeties.business.OpenSlots;
import com.tradeties.business.Openings;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * One business's diary, read over a stretch of days with a service in hand.
 *
 * <p>The counterpart to {@link NextAvailabilityAdapter}, and the reason the two are separate
 * classes rather than one with a flag: that one batches three queries across a whole page of
 * search results because a per-row read there is a hundred and fifty round trips, while this one
 * is a single profile somebody is looking at and can afford to be written plainly.
 *
 * <p>The interface belongs to {@code business} and the implementation to this module, which is
 * what keeps the dependency pointing one way.
 */
@Component
class OpenSlotsAdapter implements OpenSlots {

	private final WorkingHoursRepository hours;
	private final BookingPolicyRepository policies;
	private final TimeOffRepository absences;
	private final AcceptedAppointments accepted;

	OpenSlotsAdapter(WorkingHoursRepository hours,
			BookingPolicyRepository policies,
			TimeOffRepository absences,
			AcceptedAppointments accepted) {

		this.hours = hours;
		this.policies = policies;
		this.absences = absences;
		this.accepted = accepted;
	}

	@Override
	@Transactional(readOnly = true)
	public Openings within(UUID businessId, ZoneId zone, LocalDate from, LocalDate to,
			int appointmentMinutes, int limit) {

		// One reading of the clock, so the bounds reported below describe the same moment the
		// walk obeyed rather than one a few milliseconds later.
		Instant now = Instant.now();

		BookingRules rules = policies.findById(businessId)
				.map(BookingPolicyRow::toRules)
				.orElseGet(BookingRules::defaults);

		// The last minute of the far day rather than its start: `to` is inclusive, and a window
		// ending at midnight would lose every appointment on the day somebody asked for.
		FreeSlots.Window window = new FreeSlots.Window(
				from.atStartOfDay(zone).toInstant(),
				to.atTime(LocalTime.MAX).atZone(zone).toInstant(),
				appointmentMinutes,
				limit);

		List<Instant> starts = FreeSlots.within(week(businessId), rules,
				unavailable(businessId, rules, now), zone, now, window);

		// Asked of FreeSlots rather than worked out again here. Both bounds are its rules to
		// apply, and a second copy of them is the copy that drifts.
		return new Openings(
				LocalDate.ofInstant(FreeSlots.opensAt(rules, now, window), zone),
				FreeSlots.lastDay(rules, zone, now, window),
				starts,
				starts.size() == limit);
	}

	/** Blocks sorted within each day, because the walk down a day trusts that order. */
	private Map<DayOfWeek, List<HoursBlock>> week(UUID businessId) {
		Map<DayOfWeek, List<HoursBlock>> week = new EnumMap<>(DayOfWeek.class);

		for (WorkingHoursRow row : hours.findByBusinessIdIn(List.of(businessId))) {
			week.computeIfAbsent(row.day(), day -> new ArrayList<>()).add(row.toBlock());
		}

		week.values().forEach(blocks -> blocks.sort(Comparator.comparingInt(HoursBlock::startsAtMinutes)));

		return week;
	}

	/**
	 * Absences not yet over, which is a wider net than the window needs and the right one to cast.
	 * A holiday that began last week still covers tomorrow, so bounding this by {@code from}
	 * would let the slots it swallows reappear.
	 */
	/**
	 * Everything the business is not free for: declared time off, and the appointments it has
	 * accepted.
	 *
	 * <p>The two arrive as one list because the walk treats them alike — an hour is taken whether
	 * somebody is on holiday or already at a job. V4 writes the same sentence as arithmetic: free
	 * slots are working hours less time off less accepted appointments.
	 */
	private List<FreeSlots.Absence> unavailable(UUID businessId, BookingRules rules, Instant now) {
		return Stream.concat(away(businessId, now), booked(businessId, rules, now)).toList();
	}

	private Stream<FreeSlots.Absence> away(UUID businessId, Instant now) {
		return absences.findByBusinessIdInAndEndsAtAfter(List.of(businessId), now).stream()
				.map(row -> new FreeSlots.Absence(row.startsAt(), row.endsAt()));
	}

	/**
	 * Accepted appointments, widened by the travel time the business keeps between jobs.
	 *
	 * <p>The buffer is applied here rather than inside the walk because it belongs to the
	 * appointment and not to the grid: an hour is unbookable when taking it would leave no time to
	 * drive, and that is a fact about the job already in the diary.
	 */
	private Stream<FreeSlots.Absence> booked(UUID businessId, BookingRules rules, Instant now) {
		long buffer = rules.appointmentBufferMinutes();

		return accepted.endingAfter(List.of(businessId), now)
				.getOrDefault(businessId, List.of()).stream()
				.map(span -> new FreeSlots.Absence(
						span.startsAt().minus(buffer, ChronoUnit.MINUTES),
						span.endsAt().plus(buffer, ChronoUnit.MINUTES)));
	}
}
