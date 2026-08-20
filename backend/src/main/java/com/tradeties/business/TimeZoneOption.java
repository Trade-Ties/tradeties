package com.tradeties.business;

/**
 * One entry of the time zone select in onboarding step 2.
 *
 * @param code the IANA id, {@code America/Denver} — the value stored on the profile and the one
 *             that turns local working hours into instants. Deliberately not a UTC offset, which
 *             knows nothing about daylight saving
 */
public record TimeZoneOption(String code, String displayName) {
}
