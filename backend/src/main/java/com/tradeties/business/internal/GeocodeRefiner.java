package com.tradeties.business.internal;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Turns ZIP centroids into address-level points, in the background and a few at a time.
 *
 * <p>Every profile is placed by its postal code the moment it is saved, which is what keeps the
 * write path free of anybody else's service. This is the second pass over the same column, and
 * everything about it follows from that: it may be slow, it may fail, it may not run at all, and
 * the profile is findable throughout.
 *
 * <p><strong>The queue is a column, not a table.</strong> A precision below street level — the ZIP
 * centroid, or null where the postal code resolved to nothing — is exactly the set of profiles
 * that have not been sharpened, and because every write resets the precision, a changed address is
 * back in the set without anybody publishing an event about it. Nothing can be lost, because
 * nothing is being remembered.
 *
 * <p>The null half of that set is not a curiosity. Those profiles have no point at all, so they
 * are in no radius search and {@code ADDRESS_GEOCODED} will not let them go live; this pass, which
 * reads the street rather than the postal code, is the only thing that can still place them.
 *
 * <p>Ordinary rather than clever, for the same reason: a run that dies takes nothing with it, and
 * the next one picks up where this one was because the queue is derived from the data.
 */
@Component
@ConditionalOnProperty(name = "tradeties.census.refiner.enabled", havingValue = "true", matchIfMissing = true)
class GeocodeRefiner {

	private static final Logger log = LoggerFactory.getLogger(GeocodeRefiner.class);

	private final BusinessProfileRepository businesses;
	private final GeocodeWrites writes;
	private final CensusGeocoder census;
	private final int batchSize;
	private final Duration retryAfter;

	GeocodeRefiner(BusinessProfileRepository businesses,
			GeocodeWrites writes,
			CensusGeocoder census,
			@Value("${tradeties.census.refiner.batch-size}") int batchSize,
			@Value("${tradeties.census.refiner.retry-after}") Duration retryAfter) {

		this.businesses = businesses;
		this.writes = writes;
		this.census = census;
		this.batchSize = batchSize;
		this.retryAfter = retryAfter;
	}

	/**
	 * {@code fixedDelay}, not {@code fixedRate}: the delay is counted from the end of the previous
	 * run, so a slow pass cannot have the next one start on top of it.
	 */
	@Scheduled(fixedDelayString = "${tradeties.census.refiner.interval}",
			initialDelayString = "${tradeties.census.refiner.initial-delay}")
	void refineABatch() {
		List<BusinessProfile> waiting = businesses.findAwaitingPreciseGeocode(
				Instant.now().minus(retryAfter), Limit.of(batchSize));

		if (waiting.isEmpty()) {
			return;
		}

		int sharpened = 0;
		int attempted = 0;
		for (BusinessProfile profile : waiting) {
			GeocodeAnswer answer = census.locate(profile.address());

			// One unreachable call ends the pass. The service is down for the whole batch, not
			// for this address, so carrying on would spend twenty-four more requests learning the
			// same thing -- and every one of them would be a request to a free service that is
			// already having a bad day. Nothing is stamped, so the next pass in five minutes
			// starts from the same place.
			if (answer instanceof GeocodeAnswer.Unavailable) {
				log.warn("Geocode refiner: the service did not answer, ending this pass after {} of {}",
						attempted, waiting.size());
				break;
			}

			attempted++;
			sharpened += writes.record(profile, answer) ? 1 : 0;
		}

		if (attempted > 0) {
			log.info("Geocode refiner: {} of {} profiles sharpened to street level", sharpened, attempted);
		}
	}
}
