package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import com.tradeties.business.internal.BusinessSearchService.Window;

import org.junit.jupiter.api.Test;

/**
 * The words a customer picks, read as days on a business's calendar — at a fixed moment, so the
 * answer does not depend on the day the suite runs.
 */
class SearchWindowTests {

	private static final ZoneId DENVER = ZoneId.of("America/Denver");

	/** Thursday 1 October 2026, 23:30 in Denver — already Friday in UTC. */
	private static final Instant LATE_THURSDAY = Instant.parse("2026-10-02T05:30:00Z");

	@Test
	void todayIsTheBusinessesTodayNotTheServers() {
		LocalDate thursday = LocalDate.of(2026, 10, 1);

		assertEquals(new Window(thursday, thursday), Window.of("today", DENVER, LATE_THURSDAY));
	}

	@Test
	void tomorrowAndTheWeekCountFromThatDay() {
		LocalDate thursday = LocalDate.of(2026, 10, 1);

		assertEquals(new Window(thursday.plusDays(1), thursday.plusDays(1)), Window.of("tomorrow", DENVER, LATE_THURSDAY));
		assertEquals(new Window(thursday, LocalDate.of(2026, 10, 4)), Window.of("week", DENVER, LATE_THURSDAY),
				"the rest of the week, through Sunday");
	}

	@Test
	void aDateIsThatDayAndAPastOneIsToday() {
		LocalDate thursday = LocalDate.of(2026, 10, 1);
		LocalDate tuesday = LocalDate.of(2026, 10, 6);

		assertEquals(new Window(tuesday, tuesday), Window.of("2026-10-06", DENVER, LATE_THURSDAY));
		assertEquals(new Window(thursday, thursday), Window.of("2026-09-20", DENVER, LATE_THURSDAY));
	}

	@Test
	void nothingAskedIsNoWindow() {
		assertNull(Window.of(null, DENVER, LATE_THURSDAY));
		assertNull(Window.of("", DENVER, LATE_THURSDAY));
	}
}
