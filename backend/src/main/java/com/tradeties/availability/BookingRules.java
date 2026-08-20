package com.tradeties.availability;

/**
 * @param maxAcceptedAppointmentsPerDay {@code null} means unlimited. Counted over the
 *                                      <em>business's</em> local calendar day, not UTC — in
 *                                      America/Denver a UTC day would move the boundary into the
 *                                      afternoon
 * @param slotGranularityMinutes        the grid start times fall on: 15, 30 or 60
 */
public record BookingRules(
		int bookingHorizonDays,
		int minLeadTimeHours,
		Integer maxAcceptedAppointmentsPerDay,
		int slotGranularityMinutes,
		int appointmentBufferMinutes,
		long version) {

	public static BookingRules defaults() {
		return new BookingRules(60, 24, null, 30, 0, 0L);
	}
}
