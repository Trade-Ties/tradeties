package com.tradeties.availability.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.tradeties.availability.BookingRules;
import com.tradeties.availability.HoursBlock;

import org.junit.jupiter.api.Test;

/**
 * The walk down a working week, with the clock handed to it.
 *
 * <p>Every case here is one a real calendar produces and none of them can be reached from a
 * database without waiting for the date to come round: a daylight saving switch, a booking horizon
 * that ends mid-week, a block too short for the grid it sits on. Handing {@code now} in is what
 * makes them ordinary tests.
 *
 * <p>The zone is Denver throughout — the one the fixtures use, and one that observes a switch. The
 * same suite written in UTC would agree with an implementation that has the daylight saving bug.
 */
class FreeSlotsTests {

	private static final ZoneId DENVER = ZoneId.of("America/Denver");

	/** No notice required, a horizon nothing here reaches, half-hour grid. */
	private static final BookingRules IMMEDIATE = new BookingRules(60, 0, null, 30, 0, 0L);

	@Test
	void offersTheStartsOfAWorkingDayInOrder() {
		List<Instant> slots = upcoming(week(DayOfWeek.MONDAY, block(9, 0, 17, 0)), IMMEDIATE, List.of(),
				denver(2026, 3, 2, 0, 0), 3);

		assertEquals(List.of(LocalTime.of(9, 0), LocalTime.of(9, 30), LocalTime.of(10, 0)), localTimes(slots));
	}

	/**
	 * The lead time is the tradesperson saying "not at an hour's notice". What falls inside it is
	 * not skipped over to the end of that day — the walk starts later and offers the rest intact.
	 */
	@Test
	void refusesEverythingInsideTheLeadTime() {
		BookingRules aDayOfNotice = new BookingRules(60, 24, null, 30, 0, 0L);

		List<Instant> slots = upcoming(week(DayOfWeek.MONDAY, block(9, 0, 17, 0)), aDayOfNotice, List.of(),
				denver(2026, 3, 2, 10, 0), 1);

		// Monday 10:00 plus a day of notice is Tuesday, and Tuesday is closed. The next Monday is
		// therefore the whole answer, from the top of its day.
		assertEquals(List.of(LocalTime.of(9, 0)), localTimes(slots));
		assertEquals(LocalDate.of(2026, 3, 9), LocalDateTime.ofInstant(slots.get(0), DENVER).toLocalDate());
	}

	/**
	 * The promise the stored week makes: a wall clock, not an instant. Two Sundays either side of
	 * the spring switch both start at nine, and they are seven days <em>minus an hour</em> apart —
	 * the half that an implementation adding minutes to a zoned time gets wrong while still
	 * printing nine o'clock.
	 */
	@Test
	void keepsTheWallClockAcrossADaylightSavingSwitch() {
		List<Instant> slots = upcoming(week(DayOfWeek.SUNDAY, block(9, 0, 9, 30)), IMMEDIATE, List.of(),
				denver(2026, 2, 28, 12, 0), 2);

		assertEquals(List.of(LocalTime.of(9, 0), LocalTime.of(9, 0)), localTimes(slots));
		assertEquals(Duration.ofDays(7).minusHours(1), Duration.between(slots.get(0), slots.get(1)));
	}

	/** A declared absence removes the slots it covers, and nothing on either side of them. */
	@Test
	void stepsOverAnAbsence() {
		List<FreeSlots.Absence> away = List.of(
				new FreeSlots.Absence(denver(2026, 3, 2, 9, 0), denver(2026, 3, 2, 10, 0)));

		List<Instant> slots = upcoming(week(DayOfWeek.MONDAY, block(9, 0, 17, 0)), IMMEDIATE, away,
				denver(2026, 3, 2, 0, 0), 2);

		// Ten exactly, because that is where the absence ends and both ends are half-open.
		assertEquals(List.of(LocalTime.of(10, 0), LocalTime.of(10, 30)), localTimes(slots));
	}

	/**
	 * Half an hour that does not fit is not offered: 09:30 would end at 10:00, past a block that
	 * ends at 09:45.
	 *
	 * <p>Asserted as "the next one is next Monday" rather than as a list of one. Asking for a
	 * single slot would pass against an implementation that offered 09:30 too and merely stopped
	 * counting first; asking for two and landing a week later says the day held exactly one.
	 *
	 * <p>Compared as a date and not as a duration between the two instants, because the week this
	 * falls in contains the spring switch — seven days here is seven days minus an hour, and a
	 * test that said otherwise would be asserting the daylight saving bug rather than the block
	 * length it is named after.
	 */
	@Test
	void offersOnlySlotsThatFitWholeInsideABlock() {
		List<Instant> slots = upcoming(week(DayOfWeek.MONDAY, block(9, 0, 9, 45)), IMMEDIATE, List.of(),
				denver(2026, 3, 2, 0, 0), 2);

		assertEquals(List.of(LocalTime.of(9, 0), LocalTime.of(9, 0)), localTimes(slots));
		assertEquals(LocalDate.of(2026, 3, 9), LocalDateTime.ofInstant(slots.get(1), DENVER).toLocalDate());
	}

	/** A block starting off the grid does not drag every slot after it off the grid as well. */
	@Test
	void alignsAnOffGridBlockToTheGrid() {
		List<Instant> slots = upcoming(week(DayOfWeek.MONDAY, block(9, 20, 11, 0)), IMMEDIATE, List.of(),
				denver(2026, 3, 2, 0, 0), 2);

		assertEquals(List.of(LocalTime.of(9, 30), LocalTime.of(10, 0)), localTimes(slots));
	}

	/** The horizon is the far end of the diary. Past it there is nothing to offer, not less. */
	@Test
	void stopsAtTheBookingHorizon() {
		BookingRules untilTomorrow = new BookingRules(1, 0, null, 30, 0, 0L);

		List<Instant> slots = upcoming(week(DayOfWeek.FRIDAY, block(9, 0, 17, 0)), untilTomorrow, List.of(),
				denver(2026, 3, 2, 8, 0), 3);

		assertTrue(slots.isEmpty(), "Friday is four days past a horizon of one");
	}

	/** Closed all week is a real answer rather than an error, and it is simply an empty list. */
	@Test
	void offersNothingForAClosedWeek() {
		assertTrue(upcoming(Map.of(), IMMEDIATE, List.of(), denver(2026, 3, 2, 0, 0), 3).isEmpty());
	}

	private static List<Instant> upcoming(Map<DayOfWeek, List<HoursBlock>> week,
			BookingRules rules,
			List<FreeSlots.Absence> absences,
			Instant now,
			int wanted) {

		return FreeSlots.upcoming(week, rules, absences, DENVER, now, wanted);
	}

	private static Map<DayOfWeek, List<HoursBlock>> week(DayOfWeek day, HoursBlock... blocks) {
		return Map.of(day, List.of(blocks));
	}

	private static HoursBlock block(int fromHour, int fromMinute, int toHour, int toMinute) {
		return new HoursBlock(fromHour * 60 + fromMinute, toHour * 60 + toMinute);
	}

	private static Instant denver(int year, int month, int day, int hour, int minute) {
		return LocalDateTime.of(year, month, day, hour, minute).atZone(DENVER).toInstant();
	}

	/** What the customer reads off the card, which is the only form these are worth asserting in. */
	private static List<LocalTime> localTimes(List<Instant> slots) {
		return slots.stream().map(slot -> LocalDateTime.ofInstant(slot, DENVER).toLocalTime()).toList();
	}
}
