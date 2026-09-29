package com.tradeties.availability;

import java.util.Map;
import java.util.UUID;

/**
 * What the business decided about the requests a new entry covers.
 *
 * @param resolutions   by request id; empty on a first attempt, before anybody knows what is in the way
 * @param declineReason what the customers of declined requests are given — never the entry's note
 */
public record TimeOffAnswers(Map<UUID, Resolution> resolutions, String declineReason) {

	public TimeOffAnswers {
		resolutions = Map.copyOf(resolutions);
	}

	public enum Resolution {
		/** Turn a pending request down. */
		DECLINE,
		/** Leave a pending request open, or keep an accepted appointment. */
		KEEP
	}
}
