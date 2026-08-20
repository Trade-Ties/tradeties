package com.tradeties.availability;

import java.time.DayOfWeek;
import java.util.List;

/**
 * An empty block list means closed, which is a different statement from "not configured yet"
 * — and the reason a week is always seven entries rather than however many rows exist.
 *
 * <p>A lunch break is two blocks, not a field: {@code 08:00–12:00} and {@code 13:00–18:00}.
 */
public record OpenDay(DayOfWeek day, List<HoursBlock> blocks) {

	public OpenDay {
		blocks = blocks == null ? List.of() : List.copyOf(blocks);
	}
}
