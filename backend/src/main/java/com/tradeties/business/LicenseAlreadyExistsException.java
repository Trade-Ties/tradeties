package com.tradeties.business;

/**
 * State plus licence number is what identifies a licence in the real world, so a second row for
 * the pair is a duplicate rather than a second licence — which is what the unique index on
 * {@code (business_id, state, license_number)} says.
 */
public class LicenseAlreadyExistsException extends RuntimeException {

	public LicenseAlreadyExistsException(String state, String licenseNumber) {
		super("Licence " + licenseNumber + " in " + state + " is already on this business");
	}
}
