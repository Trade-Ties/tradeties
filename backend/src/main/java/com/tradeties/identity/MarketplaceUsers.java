package com.tradeties.identity;

import java.util.Optional;

/**
 * What other modules are allowed to ask {@code identity}.
 *
 * <p>Exists because {@code IdentityService} lives in {@code identity.internal}, which
 * Spring Modulith keeps out of reach — and reaching in is exactly what a module would do
 * to resolve a caller's local user id. Every module that stores {@code identity_user.id}
 * needs that lookup, so it is published here rather than granted by exception.
 *
 * <p>Deliberately one method. A port that grows to mirror the whole service is not a port.
 */
public interface MarketplaceUsers {

	/**
	 * @param workosUserId the {@code sub} claim of a validated access token
	 * @return the registered user behind that token, or empty if they have authenticated
	 *         but never registered. Empty is a normal answer, not an error.
	 */
	Optional<MarketplaceUser> findByWorkosUserId(String workosUserId);
}
