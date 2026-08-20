package com.tradeties.business;

/**
 * Carries the checklist rather than a message: the client has to show the same list it
 * would have shown from {@code GET /readiness}, and re-deriving it from prose would be a
 * second implementation of the rules.
 */
public class ProfileNotReadyException extends RuntimeException {

	private final transient ProfileReadiness readiness;

	public ProfileNotReadyException(ProfileReadiness readiness) {
		super("The profile is not ready to be published");
		this.readiness = readiness;
	}

	public ProfileReadiness readiness() {
		return readiness;
	}
}
