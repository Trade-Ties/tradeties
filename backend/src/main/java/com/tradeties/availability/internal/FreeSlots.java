package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.tradeties.availability.BookingRules;
import com.tradeties.availability.HoursBlock;

/**
 * The working week, walked forward from now until enough start times have been found.
 *
 * <p>Pure and static, and given its own {@code now}, so a daylight saving switch and a holiday
 * that swallows a Tuesday can be tested without a database and without waiting for either.
 *
 * <p><strong>Accepted appointments are not subtracted, because none can exist.</strong> This
 * schema has no appointment table; the module that books one arrives with {@code job}. When it
 * does, this is where it subtracts, and it is where {@code appointmentBufferMinutes} and
 * {@code maxAcceptedAppointmentsPerDay} start meaning something. Both are read from the rules and
 * both are correctly no-ops today — neither can bind against zero appointments — which is why
 * they are absent below rather than forgotten.
 */
final class FreeSlots {

	/**
	 * A stretch the business is away, reduced to the two fields the walk reads.
	 *
	 * <p>Not the entity. The walk is arithmetic and has no business holding a row that knows how to
	 * be persisted — and a record can be built in a test for a Tuesday in March without a database
	 * underneath it.
	 */
	record Absence(Instant startsAt, Instant endsAt) {
	}

	private FreeSlots() {
	}

	/**
	 * @param week the business's own hours, blocks within a day in start order
	 * @param zone what the stored wall clock is read against. "Mondays from 8" is 8 in the
	 *        business's own time, on both sides of a daylight saving switch
	 * @return start times, soonest first, at most {@code wanted} of them
	 */
	static List<Instant> upcoming(Map<DayOfWeek, List<HoursBlock>> week,
			BookingRules rules,
			List<Absence> absences,
			ZoneId zone,
			Instant now,
			int wanted) {

		List<Instant> found = new ArrayList<>(Math.max(wanted, 0));
		if (wanted <= 0) {
			return found;
		}

		// Both bounds come from the rules, and they are measured from different places on purpose.
		// The lead time is a duration from this moment; the horizon is a count of calendar days,
		// so it is counted in the business's own dates rather than in 24-hour blocks.
		Instant earliest = now.plus(rules.minLeadTimeHours(), ChronoUnit.HOURS);
		LocalDate lastDay = LocalDate.ofInstant(now, zone).plusDays(rules.bookingHorizonDays());

		int step = rules.slotGranularityMinutes();

		for (LocalDate day = LocalDate.ofInstant(earliest, zone); !day.isAfter(lastDay); day = day.plusDays(1)) {
			for (HoursBlock block : week.getOrDefault(day.getDayOfWeek(), List.of())) {

				// A start only counts if a whole slot fits before the block ends: 08:00-12:00 on a
				// half-hour grid offers eight starts, the last at 11:30, not nine ending at 12:30.
				for (int minute = onGrid(block.startsAtMinutes(), step);
						minute + step <= block.endsAtMinutes();
						minute += step) {

					// Wall clock first, instant second. Adding minutes to a zoned time adds real
					// time and would drag the start across a daylight saving switch; adding them to
					// a local time and resolving afterwards is what keeps 8 at 8.
					Instant start = LocalDateTime.of(day, LocalTime.MIDNIGHT)
							.plusMinutes(minute)
							.atZone(zone)
							.toInstant();

					if (start.isBefore(earliest) || isAway(absences, start, start.plus(step, ChronoUnit.MINUTES))) {
						continue;
					}

					found.add(start);
					if (found.size() == wanted) {
						return found;
					}
				}
			}
		}

		return found;
	}

	/**
	 * The first start at or after {@code minute} that lands on the grid the business books on.
	 *
	 * <p>Stored hours very nearly always start on it already. Very nearly is the reason this
	 * exists: a week saved at 08:20 on a half-hour grid would otherwise offer 08:20, and every
	 * slot after it, at twenty past — a grid that is not one.
	 */
	private static int onGrid(int minute, int step) {
		int overshoot = minute % step;
		return overshoot == 0 ? minute : minute + (step - overshoot);
	}

	/** Half-open on both sides: an absence ending at 13:00 leaves a slot starting at 13:00 free. */
	private static boolean isAway(List<Absence> absences, Instant start, Instant end) {
		return absences.stream().anyMatch(off -> off.startsAt().isBefore(end) && start.isBefore(off.endsAt()));
	}
}
