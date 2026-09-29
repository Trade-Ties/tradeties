package com.tradeties.business.internal;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.tradeties.business.NextAvailability;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The landing page's headline: how many businesses could take a job soon.
 *
 * <p><strong>Asked through {@link NextAvailability}, the port the search uses</strong>, and it has
 * to stay that way. A second definition of "free" — working hours in the window, say, without the
 * notice subtracted — would count businesses whose cards then show nothing that soon.
 *
 * <p><strong>Kept for {@code ttl} rather than recomputed per call.</strong> Unlike the search this
 * walks every published calendar, not one page of them, and it is asked by every anonymous visit
 * to the landing page.
 */
@Service
public class MarketplaceSummaryService {

	/**
	 * Twice the default day of notice, so the window always holds a whole working day after it.
	 * At 24 hours, "free today" was empty for every business on the default rules, and "tomorrow"
	 * asked at 8 in the evening only reaches the part of tomorrow nobody works.
	 */
	private static final Duration WINDOW = Duration.ofHours(48);

	/** @param freeWithinWindow how many businesses have a start within {@link #WINDOW} of now */
	public record Summary(int freeWithinWindow, Duration window) {
	}

	private record Counted(Summary summary, Instant at) {
	}

	private final BusinessSearchRepository businesses;
	private final NextAvailability availability;
	private final Duration ttl;

	private volatile Counted last;

	/**
	 * @param ttl how long one count is handed out again, from
	 *        {@code tradeties.marketplace.summary-ttl}. Zero recounts on every call, which is what
	 *        the tests run with
	 */
	MarketplaceSummaryService(BusinessSearchRepository businesses, NextAvailability availability,
			@Value("${tradeties.marketplace.summary-ttl}") Duration ttl) {

		this.businesses = businesses;
		this.availability = availability;
		this.ttl = ttl;
	}

	public Summary summary() {
		Instant now = Instant.now();

		Counted cached = last;
		if (cached != null && now.isBefore(cached.at().plus(ttl))) {
			return cached.summary();
		}

		Map<UUID, NextAvailability.Asked> asked = businesses.findSearchable().stream()
				.collect(Collectors.toMap(BusinessSearchRepository.ZoneRow::getId,
						row -> new NextAvailability.Asked(ZoneId.of(row.getTimeZone()), null)));

		// One start is enough: the soonest one either falls inside the window or nothing does.
		Summary counted = new Summary(freeBefore(availability.nextSlots(asked, 1), now.plus(WINDOW)), WINDOW);
		last = new Counted(counted, now);

		return counted;
	}

	/** How many of these businesses have their soonest start before {@code until}. */
	static int freeBefore(Map<UUID, List<Instant>> soonest, Instant until) {
		return (int) soonest.values().stream()
				.filter(starts -> !starts.isEmpty() && starts.getFirst().isBefore(until))
				.count();
	}
}
