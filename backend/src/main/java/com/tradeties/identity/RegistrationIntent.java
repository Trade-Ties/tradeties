package com.tradeties.identity;

import java.util.Set;

/**
 * Which side of the marketplace someone is joining.
 *
 * <p>The client states an intent; this enum — not the client — decides which roles that
 * grants. That indirection is the whole point: an endpoint taking a {@link Role} straight
 * from a request body would let any signed-in caller name {@code PLATFORM_ADMIN}.
 *
 * <p>Only tradespeople register today. Customers use TradeTies anonymously and need no
 * account at all, so there is no {@code CUSTOMER} intent yet; adding one later is a purely
 * additive change to both this enum and the contract.
 */
public enum RegistrationIntent {

	/**
	 * Someone signing up through the portal to offer work. Granted {@link Role#BUSINESS_OWNER}
	 * rather than {@link Role#BUSINESS_MEMBER}: they are creating their own business, not
	 * joining one. Members arrive by invitation from an owner, which is a different flow.
	 */
	TRADESPERSON(Role.BUSINESS_OWNER);

	private final Set<Role> grants;

	RegistrationIntent(Role... grants) {
		this.grants = Set.of(grants);
	}

	/** @return the roles this intent grants; never removes roles already held */
	public Set<Role> grants() {
		return grants;
	}
}
