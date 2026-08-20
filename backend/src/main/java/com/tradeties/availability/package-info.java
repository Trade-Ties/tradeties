/**
 * Availability — when a business works, and the rules that turn that into bookable slots.
 *
 * <p>A module of its own rather than a corner of {@code business}, because working hours, time
 * off and accepted appointments have to agree with each other, and that agreement is not the
 * profile's business.
 *
 * <p><strong>Free slots are not stored.</strong> They are working hours minus time off minus
 * accepted appointments, intersected with the booking window and cut to the length of the chosen
 * service. A materialised slot table would be a second source of truth that could drift.
 *
 * <p>This module depends on {@code business} and never the other way round. That one-way arrow
 * is what makes the booking policy row provision itself here rather than be created by the
 * profile.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Availability")
package com.tradeties.availability;
