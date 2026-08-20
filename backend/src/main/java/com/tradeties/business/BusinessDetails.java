package com.tradeties.business;

/**
 * Exists so the JPA entity never leaves {@code business.internal} — handing an entity out
 * hands out a live persistence context along with it.
 *
 * <p>Carries no id. Nothing outside this module addresses a business by id: the owner reaches it
 * through their token, and the public side will reach it through the slug.
 *
 * @param phone       E.164, the business line — not the login
 * @param email       the business address — not the login
 * @param coordinates {@code null} while the address has not been geocoded
 * @param timeZone    IANA zone; working hours are local wall clock resolved through it
 * @param version     optimistic lock, handed back on the next write
 */
public record BusinessDetails(
		String slug,
		String legalName,
		String displayName,
		String description,
		String websiteUrl,
		String phone,
		String email,
		PostalAddress address,
		GeoPoint coordinates,
		String timeZone,
		int serviceRadiusMiles,
		BusinessStatus status,
		int onboardingCompletedStep,
		long version) {
}
