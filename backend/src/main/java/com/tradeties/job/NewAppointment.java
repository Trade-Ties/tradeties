package com.tradeties.job;

import java.util.List;
import java.util.UUID;

/**
 * @param replacesRequestId a pending request this takes the place of, or null. When set, the
 *        appointment joins that request's job and the customer fields in {@code details} are not read
 * @param resolutions what happens to the accepted appointments in the way; empty on a first attempt
 */
public record NewAppointment(UUID serviceId, UUID replacesRequestId, AppointmentDetails details,
		List<AppointmentResolution> resolutions) {

	public NewAppointment {
		resolutions = resolutions == null ? List.of() : List.copyOf(resolutions);
	}
}
