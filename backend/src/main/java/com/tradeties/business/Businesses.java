package com.tradeties.business;

import java.util.Optional;
import java.util.UUID;

/**
 * What other modules are allowed to ask {@code business}.
 *
 * <p>The counterpart of {@link com.tradeties.identity.MarketplaceUsers} one module down.
 * Publishing this one lookup is what keeps other modules out of {@code business.internal}.
 *
 * <p>Handing out the raw id is deliberate and not a leak: foreign keys cross module boundaries in
 * this model, and {@code availability_working_hours.business_id} is one of them.
 */
public interface Businesses {

	/**
	 * @param ownerUserId the local {@code identity_user.id} of the caller, never the WorkOS id
	 * @return the id of the business they own, or empty if they have none yet. Empty is a normal
	 *         answer — a tradesperson who has not finished onboarding step 2 has no business.
	 */
	Optional<UUID> findIdByOwner(UUID ownerUserId);
}
