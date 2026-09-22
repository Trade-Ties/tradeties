package com.tradeties.business;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * What {@link OpenSlots} answers: the free starts, and the days they were actually read over.
 *
 * <p><strong>The window comes back because it is rarely the one that was asked for.</strong> The
 * notice the tradesperson requires moves the near end, the booking horizon moves the far end, and
 * a caller holding only the starts could not tell a fortnight with nothing free in it from a
 * diary that reaches two days. Those are different things to say to somebody waiting for an
 * appointment, and only one of them is worth trying another week for.
 *
 * <p>{@code from} after {@code to} is a real answer rather than a broken one: a business whose
 * notice reaches past its own horizon has no bookable day, and this is where that shows.
 *
 * @param capped whether the walk stopped at the caller's limit before reaching {@code to}, so
 *        later days in the window were never looked at
 */
public record Openings(LocalDate from, LocalDate to, List<Instant> starts, boolean capped) {

	public Openings {
		starts = starts == null ? List.of() : List.copyOf(starts);
	}
}
