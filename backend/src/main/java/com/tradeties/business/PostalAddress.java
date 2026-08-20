package com.tradeties.business;

/**
 * @param street2 suite, unit, floor — may be {@code null}
 * @param state   two-letter USPS code, which must exist in {@code us_state}
 */
public record PostalAddress(
		String street1,
		String street2,
		String city,
		String state,
		String postalCode) {
}
