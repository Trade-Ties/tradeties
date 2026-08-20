package com.tradeties.availability;

import java.time.DayOfWeek;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * A whole working week, Monday first, always seven days.
 *
 * <p>The client edits a week as one form and the blocks are validated against each other, so
 * accepting them a day at a time would let a client build an invalid week out of valid steps.
 *
 * <p>A weekday appears exactly once. A second stretch of work on the same day is a second
 * {@link HoursBlock} within that {@link OpenDay}, never a second entry for the day.
 */
public record WorkingWeek(List<OpenDay> days) {

	/**
	 * Refused here rather than in the service, so a {@code WorkingWeek} with a repeated day cannot
	 * exist anywhere and {@link #byDay()} needs no defence of its own.
	 *
	 * @throws InvalidWorkingWeekException if a weekday appears more than once
	 */
	public WorkingWeek {
		days = days == null ? List.of() : List.copyOf(days);

		Set<DayOfWeek> seen = EnumSet.noneOf(DayOfWeek.class);
		for (OpenDay day : days) {
			if (!seen.add(day.day())) {
				throw new InvalidWorkingWeekException(day.day()
						+ " appears twice. A second stretch of work on the same day is a second "
						+ "block within that day, not a second entry for it.");
			}
		}
	}

	public static WorkingWeek closed() {
		return new WorkingWeek(Arrays.stream(DayOfWeek.values())
				.map(day -> new OpenDay(day, List.of()))
				.toList());
	}

	/** @return the days the caller left out, filled in as closed */
	public Map<DayOfWeek, OpenDay> byDay() {
		// No merge function on purpose: the constructor has already refused a repeated weekday, so a
		// collision here is a bug and must be heard. `(a, b) -> a` would silently drop the second
		// entry and answer 200 for a week nobody submitted.
		Map<DayOfWeek, OpenDay> present = days.stream()
				.collect(Collectors.toMap(OpenDay::day, Function.identity()));

		return Arrays.stream(DayOfWeek.values())
				.collect(Collectors.toMap(Function.identity(),
						day -> present.getOrDefault(day, new OpenDay(day, List.of())),
						(a, b) -> a,
						java.util.LinkedHashMap::new));
	}
}
