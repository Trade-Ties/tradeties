package com.tradeties.availability;

/**
 * One continuous stretch of work on one day, as minutes since local midnight.
 *
 * <p>Local wall clock, not an instant: "Mondays from 8" still means 8 after a daylight saving
 * switch. The profile's zone turns it into a moment, and only the resulting slots are instants.
 *
 * <p>Minutes rather than {@link java.time.LocalTime} because a day can end at midnight, which is
 * 1440 — a value {@code LocalTime} cannot hold. Moving to {@code LocalTime} would force
 * {@code 00:00} to mean "start of day" in one field and "end of day" in the other, and every
 * comparison that forgot it would still compile.
 *
 * <p>Half-open, {@code [startsAtMinutes, endsAtMinutes)} — the same boundary the exclusion
 * constraint in the schema uses, and what makes 08:00–12:00 and 12:00–18:00 adjacent rather than
 * overlapping.
 */
public record HoursBlock(int startsAtMinutes, int endsAtMinutes) {

	public static final int END_OF_DAY = 24 * 60;

	/**
	 * Whether the end comes after the start is deliberately not checked here, but where the weekday
	 * is known and can be named in the message.
	 */
	public HoursBlock {
		if (startsAtMinutes < 0 || startsAtMinutes > END_OF_DAY) {
			throw new IllegalArgumentException("Not a minute of the day: " + startsAtMinutes);
		}
		if (endsAtMinutes < 0 || endsAtMinutes > END_OF_DAY) {
			throw new IllegalArgumentException("Not a minute of the day: " + endsAtMinutes);
		}
	}

	public boolean overlaps(HoursBlock other) {
		return startsAtMinutes < other.endsAtMinutes && other.startsAtMinutes < endsAtMinutes;
	}
}
