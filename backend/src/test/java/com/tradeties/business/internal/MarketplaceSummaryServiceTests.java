package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.time.ZoneId;
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

	/**
	 * Today on the business's own calendar: 01:00 UTC on the 2nd is still the evening of the 1st
	 * in Denver, so a start then is today there.
	 */
	@Test
	void freeTodayIsReadOnTheBusinessesCalendar() {
		UUID business = UUID.randomUUID();
		Instant morningInDenver = Instant.parse("2026-10-01T17:30:00Z");
		Map<UUID, ZoneId> zones = Map.of(business, DENVER);

		assertEquals(1, MarketplaceSummaryService.freeToday(
				Map.of(business, List.of(Instant.parse("2026-10-02T01:00:00Z"))), zones, morningInDenver));
		assertEquals(0, MarketplaceSummaryService.freeToday(
				Map.of(business, List.of(Instant.parse("2026-10-02T15:00:00Z"))), zones, morningInDenver),
				"the 2nd at 9 in the morning in Denver is tomorrow");
		assertEquals(0, MarketplaceSummaryService.freeToday(Map.of(business, List.of()), zones, morningInDenver));
	}

	private static final ZoneId DENVER = ZoneId.of("America/Denver");

	private static int count(String soonest) {
		return MarketplaceSummaryService.freeBefore(
				Map.of(UUID.randomUUID(), List.of(Instant.parse(soonest))), UNTIL);
	}
}
