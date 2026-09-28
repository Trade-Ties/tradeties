package com.tradeties.job;

import java.time.Instant;
import java.util.UUID;

import com.tradeties.business.PostalAddress;

/**
 * What a customer supplied, in the module's own words rather than the wire's.
 *
 * <p><strong>Deliberately holds nothing priced.</strong> Every term a request freezes comes from
 * the profile, so there is no field here a caller could use to propose their own. That is not a
 * convenience — what was displayed is what binds, and a body that could carry a cancellation fee
 * could carry a different one.
 *
 * @param startsAt the instant they picked, unverified at this point. It is checked against the
 *        calendar before anything is written
 */
public record NewJob(
		String slug,
		UUID serviceId,
		Instant startsAt,
		String customerName,
		String customerEmail,
		String customerPhone,
		String description,
		PostalAddress address) {
}
