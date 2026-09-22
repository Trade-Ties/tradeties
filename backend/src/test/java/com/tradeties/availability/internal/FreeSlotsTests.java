package com.tradeties.availability.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
 *
 * <p>The {@code upcoming} cases come first and the {@code within} cases after, which is also the
 * order the two were written in. The first group is the regression suite for a method that now
 * delegates: it says the card kept the answers it had while the length underneath it became a
 * second number.
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
	 * A block too short to hold a second grid start holds the first one anyway: twenty minutes
	 * from nine offers 09:00, and 09:30 is past the end of it.
	 *
	 * <p>This is the surviving half of the old fitting rule. A block ending at 09:45 now offers
	 * 09:30 as well, although nothing can be finished in the fifteen minutes left — see
	 * {@link #offersEveryGridStartInsideTheBlock}. What still bounds the walk is the start itself
	 * having to fall inside the block.
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
	void offersTheOpeningStartOfABlockShorterThanTheGrid() {
		List<Instant> slots = upcoming(week(DayOfWeek.MONDAY, block(9, 0, 9, 20)), IMMEDIATE, List.of(),
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

	/**
	 * Two facts in one list. The starts are half an hour apart, because that is the grid — not
	 * ninety minutes apart, which is what an implementation stepping by the length would answer.
	 * And the last of them is 11:30, although ninety minutes from 11:30 runs to 13:00: the end of
	 * the block bounds where work may begin, not where it may finish.
	 */
	@Test
	void offersEveryGridStartInsideTheBlock() {
		List<Instant> slots = within(week(DayOfWeek.MONDAY, block(8, 0, 12, 0)), IMMEDIATE, List.of(),
				denver(2026, 3, 2, 0, 0), thatMonday(90, 20));

		assertEquals(List.of(LocalTime.of(8, 0), LocalTime.of(8, 30), LocalTime.of(9, 0),
				LocalTime.of(9, 30), LocalTime.of(10, 0), LocalTime.of(10, 30),
				LocalTime.of(11, 0), LocalTime.of(11, 30)), localTimes(slots));
	}

	/**
	 * The same block, the same grid, two very different jobs, one list. This is the statement the
	 * change of 2026-09-22 makes: how long the work takes no longer decides where it may start.
	 */
	@Test
	void offersTheSameStartsWhateverTheWorkTakes() {
		var monday = week(DayOfWeek.MONDAY, block(8, 0, 12, 0));
		Instant midnight = denver(2026, 3, 2, 0, 0);

		assertEquals(localTimes(within(monday, IMMEDIATE, List.of(), midnight, thatMonday(30, 20))),
				localTimes(within(monday, IMMEDIATE, List.of(), midnight, thatMonday(240, 20))));
	}

	/**
	 * An hour away from nine costs four starts, not one, and 08:00 is the one worth naming: half an
	 * hour from eight clears the absence and ninety minutes from eight runs into it. Measured
	 * against the grid rather than against the appointment, this answers with a slot that collides.
	 *
	 * <p>The far end of the list is the other half of the rule: 11:30 survives although the work
	 * runs to 13:00, because a block ending is the shape of a day and an absence is the
	 * tradesperson not being there. The two lengths are not measured the same way on purpose.
	 */
	@Test
	void countsTheWholeAppointmentAgainstAnAbsence() {
		List<FreeSlots.Absence> away = List.of(
				new FreeSlots.Absence(denver(2026, 3, 2, 9, 0), denver(2026, 3, 2, 10, 0)));

		List<Instant> slots = within(week(DayOfWeek.MONDAY, block(8, 0, 12, 0)), IMMEDIATE, away,
				denver(2026, 3, 2, 0, 0), thatMonday(90, 20));

		assertEquals(List.of(LocalTime.of(10, 0), LocalTime.of(10, 30),
				LocalTime.of(11, 0), LocalTime.of(11, 30)), localTimes(slots));
	}

	/**
	 * The far end of the window is the last <em>start</em>, not the last minute of work. An
	 * appointment beginning at nine and running to ten belongs to a window that ends at nine —
	 * read the other way, somebody asking for Tuesday would lose Tuesday's last appointment.
	 */
	@Test
	void takesTheEndOfTheWindowAsTheLastStart() {
		Instant monday = denver(2026, 3, 2, 0, 0);

		List<Instant> slots = within(week(DayOfWeek.MONDAY, block(8, 0, 12, 0)), IMMEDIATE, List.of(),
				monday, new FreeSlots.Window(monday, denver(2026, 3, 2, 9, 0), 60, 20));

		assertEquals(List.of(LocalTime.of(8, 0), LocalTime.of(8, 30), LocalTime.of(9, 0)), localTimes(slots));
	}

	/** Asking for more than the diary holds reaches the end of it, not past it. */
	@Test
	void cannotBeAskedPastTheBookingHorizon() {
		BookingRules untilTomorrow = new BookingRules(1, 0, null, 30, 0, 0L);
		Instant monday = denver(2026, 3, 2, 8, 0);

		List<Instant> slots = within(week(DayOfWeek.FRIDAY, block(9, 0, 17, 0)), untilTomorrow, List.of(),
				monday, new FreeSlots.Window(monday, denver(2026, 4, 1, 0, 0), 60, 20));

		assertTrue(slots.isEmpty(), "thirty days asked for does not lengthen a horizon of one");
	}

	/**
	 * The notice is a floor under the window rather than the place it starts. A window opening late
	 * enough is left where it is — without that, somebody looking at next week would be answered
	 * with this afternoon.
	 */
	@Test
	void opensWhereAskedWhenThatIsLaterThanTheNotice() {
		Instant monday = denver(2026, 3, 2, 0, 0);

		List<Instant> slots = within(week(DayOfWeek.MONDAY, block(8, 0, 17, 0)), IMMEDIATE, List.of(),
				monday, new FreeSlots.Window(denver(2026, 3, 2, 10, 0), endOf(monday), 60, 2));

		assertEquals(List.of(LocalTime.of(10, 0), LocalTime.of(10, 30)), localTimes(slots));
	}

	/** And a window that lies entirely inside the notice has nothing left after the floor is applied. */
	@Test
	void answersNothingForAWindowEntirelyInsideTheNotice() {
		BookingRules aDayOfNotice = new BookingRules(60, 24, null, 30, 0, 0L);
		Instant monday = denver(2026, 3, 2, 10, 0);

		List<Instant> slots = within(week(DayOfWeek.MONDAY, block(8, 0, 17, 0)), aDayOfNotice, List.of(),
				monday, new FreeSlots.Window(denver(2026, 3, 2, 0, 0), endOf(monday), 60, 20));

		assertTrue(slots.isEmpty(), "the whole of today is inside a day of notice");
	}

	/** The limit stops the walk rather than trimming its answer, so an open window is still cheap. */
	@Test
	void walksNoFurtherThanTheLimit() {
		Instant monday = denver(2026, 3, 2, 0, 0);

		List<Instant> slots = within(week(DayOfWeek.MONDAY, block(8, 0, 12, 0)), IMMEDIATE, List.of(),
				monday, new FreeSlots.Window(monday, null, 60, 2));

		assertEquals(List.of(LocalTime.of(8, 0), LocalTime.of(8, 30)), localTimes(slots));
	}

	/**
	 * A length of zero is the shape the old conflation would have arrived in — a caller that had no
	 * service and passed nothing. It is refused where it is built rather than answered with every
	 * grid point in the window.
	 */
	@Test
	void refusesAnAppointmentWithNoLength() {
		Instant monday = denver(2026, 3, 2, 0, 0);

		assertThrows(IllegalArgumentException.class, () -> new FreeSlots.Window(monday, null, 0, 5));
	}

	private static List<Instant> upcoming(Map<DayOfWeek, List<HoursBlock>> week,
			BookingRules rules,
			List<FreeSlots.Absence> absences,
			Instant now,
			int wanted) {

		return FreeSlots.upcoming(week, rules, absences, DENVER, now, wanted);
	}

	private static List<Instant> within(Map<DayOfWeek, List<HoursBlock>> week,
			BookingRules rules,
			List<FreeSlots.Absence> absences,
			Instant now,
			FreeSlots.Window window) {

		return FreeSlots.within(week, rules, absences, DENVER, now, window);
	}

	/**
	 * The whole of Monday 2 March and nothing after it.
	 *
	 * <p>Bounded on purpose: these cases are about one day's blocks, and an open window would walk
	 * into the following Monday and assert the same six times twice over.
	 */
	private static FreeSlots.Window thatMonday(int lengthMinutes, int limit) {
		Instant monday = denver(2026, 3, 2, 0, 0);
		return new FreeSlots.Window(monday, endOf(monday), lengthMinutes, limit);
	}

	/** The last minute of the day a given instant falls in, in Denver. */
	private static Instant endOf(Instant day) {
		return LocalDateTime.ofInstant(day, DENVER).toLocalDate()
				.atTime(LocalTime.MAX)
				.atZone(DENVER)
				.toInstant();
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
