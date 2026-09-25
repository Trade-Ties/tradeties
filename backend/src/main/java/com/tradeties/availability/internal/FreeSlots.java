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
 * The working week, walked forward and cut into the appointments that fit in it.
 *
 * <p>Pure and static, and given its own {@code now}, so a daylight saving switch and a holiday
 * that swallows a Tuesday can be tested without a database and without waiting for either.
 *
 * <p><strong>The grid says where an appointment may start; its length does not say whether it
 * may.</strong> Every grid start inside a block is offered, so a block ending at noon offers eight
 * of them on a half-hour grid and the last is 11:30 — for a ninety-minute job as much as for a
 * half-hour one. The work then runs past the end of the block, and whether that suits is the
 * tradesperson's answer to a request rather than this walk's assumption. It was the other way
 * round until 2026-09-22, when the last start for a long job was the last one ending inside the
 * block.
 *
 * <p><strong>Declared time off still cuts by the whole length</strong>, and the asymmetry is
 * deliberate rather than an oversight to tidy up: the end of a block is the shape of a working
 * day, which a tradesperson can stretch, while an absence is them not being there to stretch it.
 * A job long enough to run into a holiday is therefore not offered a start before it, though one
 * long enough to run past five o'clock is.
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

	/**
	 * What is being asked of the week: a stretch to look in, and how long a slot in it has to be.
	 *
	 * <p>The two travel together because neither is a question on its own — "free on Tuesday" is
	 * only answerable once somebody has said free for how long.
	 *
	 * @param from the earliest start worth having. A window opening in the past, or inside the
	 *        notice the tradesperson requires, is shortened rather than refused
	 * @param to the last start worth having, or {@code null} for as far as the booking horizon
	 *        reaches. Shortened to that horizon either way, so asking for more than the diary
	 *        holds cannot reach past the end of it
	 * @param lengthMinutes how long the appointment runs, which is the chosen service's duration.
	 *        Measured against declared time off and never against the end of a working block —
	 *        see the class note. {@link #upcoming} passes the grid instead, and says there why
	 * @param limit how many starts are worth walking for. A month of a quarter-hour grid is some
	 *        two thousand of them, and no caller has a use for the tail
	 */
	record Window(Instant from, Instant to, int lengthMinutes, int limit) {

		Window {
			if (lengthMinutes <= 0) {
				throw new IllegalArgumentException("An appointment has a length: " + lengthMinutes);
			}
		}
	}

	private FreeSlots() {
	}

	/**
	 * Every start in the asked window that the business's own grid offers.
	 *
	 * @param week the business's own hours, blocks within a day in start order
	 * @param zone what the stored wall clock is read against. "Mondays from 8" is 8 in the
	 *        business's own time, on both sides of a daylight saving switch
	 * @return start times, soonest first, at most {@link Window#limit()} of them
	 */
	static List<Instant> within(Map<DayOfWeek, List<HoursBlock>> week,
			BookingRules rules,
			List<Absence> absences,
			ZoneId zone,
			Instant now,
			Window window) {

		List<Instant> found = new ArrayList<>();
		if (window.limit() <= 0) {
			return found;
		}

		Instant earliest = opensAt(rules, now, window);
		LocalDate lastDay = lastDay(rules, zone, now, window);

		int step = rules.slotGranularityMinutes();
		int length = window.lengthMinutes();

		for (LocalDate day = LocalDate.ofInstant(earliest, zone); !day.isAfter(lastDay); day = day.plusDays(1)) {
			for (HoursBlock block : week.getOrDefault(day.getDayOfWeek(), List.of())) {

				// Every grid start that begins inside the block, whatever the work is: 08:00-12:00
				// on a half-hour grid offers eight, and the last is 11:30 even for a job that then
				// runs past noon. Bounding this by `length` is the rule this replaced — read the
				// class note before restoring it.
				for (int minute = onGrid(block.startsAtMinutes(), step);
						minute < block.endsAtMinutes();
						minute += step) {

					// Wall clock first, instant second. Adding minutes to a zoned time adds real
					// time and would drag the start across a daylight saving switch; adding them to
					// a local time and resolving afterwards is what keeps 8 at 8.
					Instant start = LocalDateTime.of(day, LocalTime.MIDNIGHT)
							.plusMinutes(minute)
							.atZone(zone)
							.toInstant();

					if (start.isBefore(earliest)) {
						continue;
					}
					// Starts are generated in order, so nothing after this one is in the window
					// either. The day loop above narrows to the date; this is the instant.
					if (window.to() != null && start.isAfter(window.to())) {
						return found;
					}
					if (isAway(absences, start, start.plus(length, ChronoUnit.MINUTES))) {
						continue;
					}

					found.add(start);
					if (found.size() == window.limit()) {
						return found;
					}
				}
			}
		}

		return found;
	}

	/**
	 * The first few openings, for a reader who has not chosen a service yet.
	 *
	 * <p><strong>The grid stands in for the length, and that is the honest reading of an
	 * unanswered question</strong> rather than a shortcut. Nothing here knows what the job is, so
	 * there is no duration to cut by, and the grid is the only length the business has declared.
	 * Since the block bound no longer reads the length, these starts part company with a chosen
	 * service's only where declared time off is long enough to tell them apart — still reason
	 * enough to show them as openings rather than as an offer.
	 *
	 * @return start times, soonest first, at most {@code wanted} of them
	 */
	static List<Instant> upcoming(Map<DayOfWeek, List<HoursBlock>> week,
			BookingRules rules,
			List<Absence> absences,
			ZoneId zone,
			Instant now,
			int wanted) {

		return within(week, rules, absences, zone, now,
				new Window(now, null, rules.slotGranularityMinutes(), wanted));
	}

	/**
	 * The later of when the window opens and when the notice allows anything at all.
	 *
	 * <p>Exposed beside {@link #lastDay} so that a caller reporting which days it covered reads
	 * the same two bounds the walk obeyed. They are measured from different places on purpose: the
	 * notice is a duration from this moment, while the horizon below is a count of calendar days,
	 * counted in the business's own dates rather than in 24-hour blocks.
	 */
	static Instant opensAt(BookingRules rules, Instant now, Window window) {
		Instant notice = now.plus(rules.minLeadTimeHours(), ChronoUnit.HOURS);
		return window.from().isAfter(notice) ? window.from() : notice;
	}

	/** The nearer of what was asked for and what the diary reaches. */
	static LocalDate lastDay(BookingRules rules, ZoneId zone, Instant now, Window window) {
		LocalDate horizon = LocalDate.ofInstant(now, zone).plusDays(rules.bookingHorizonDays());
		if (window.to() == null) {
			return horizon;
		}

		LocalDate asked = LocalDate.ofInstant(window.to(), zone);
		return asked.isBefore(horizon) ? asked : horizon;
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
