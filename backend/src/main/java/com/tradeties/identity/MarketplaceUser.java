package com.tradeties.identity;

import java.util.Set;
import java.util.UUID;

/**
 * What {@code identity} tells the rest of the system about a registered person.
 *
 * <p>Exists so the JPA entity never leaves {@code identity.internal}. Handing an entity
 * across a module boundary hands out a live persistence context and every field on it;
 * this record hands out a value.
 *
 * @param id            our id — the one other modules reference and store
 * @param workosUserId  the external WorkOS id, useful for support and log correlation.
 *                      Never foreign-key domain data to it (DECISIONS section 7).
 * @param email         may be {@code null}: the token is not required to carry one
 * @param roles         may be empty for a caller who is signed in but not registered
 */
public record MarketplaceUser(UUID id, String workosUserId, String email, Set<Role> roles) {

	public MarketplaceUser {
		roles = roles == null ? Set.of() : Set.copyOf(roles);
	}

	/** @return whether this user may act on behalf of a business */
	public boolean isTradesperson() {
		return roles.contains(Role.BUSINESS_OWNER) || roles.contains(Role.BUSINESS_MEMBER);
	}
}
