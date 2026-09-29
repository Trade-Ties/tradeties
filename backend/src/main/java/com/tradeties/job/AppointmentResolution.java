package com.tradeties.job;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * What happens to an accepted appointment in the way of another. Keeping it is not an answer:
 * one business holds one appointment at a time.
 *
 * @param startsAt read for {@code MOVE}, on the business's wall clock
 * @param endsAt   read for {@code MOVE}
 */
public record AppointmentResolution(UUID requestId, Action action, LocalDateTime startsAt, LocalDateTime endsAt) {

	public enum Action {
		MOVE,
		CANCEL
	}
}
