package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Which soonest starts fall inside the window. */
class MarketplaceSummaryServiceTests {

	private static final Instant UNTIL = Instant.parse("2026-10-01T18:00:00Z");

	@Test
	void aStartBeforeTheEndOfTheWindowCounts() {
		assertEquals(1, count("2026-10-01T17:30:00Z"));
	}

	/** The end is open: a start exactly at it is the first one outside. */
	@Test
	void aStartAtOrAfterTheEndDoesNot() {
		assertEquals(0, count("2026-10-01T18:00:00Z"));
		assertEquals(0, count("2026-10-02T09:00:00Z"));
	}

	@Test
	void noStartsAtAllCountsForNothing() {
		assertEquals(0, MarketplaceSummaryService.freeBefore(Map.of(), UNTIL));
		assertEquals(0, MarketplaceSummaryService.freeBefore(Map.of(UUID.randomUUID(), List.of()), UNTIL));
	}

	private static int count(String soonest) {
		return MarketplaceSummaryService.freeBefore(
				Map.of(UUID.randomUUID(), List.of(Instant.parse(soonest))), UNTIL);
	}
}
