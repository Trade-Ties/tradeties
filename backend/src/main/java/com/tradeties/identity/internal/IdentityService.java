package com.tradeties.identity.internal;

import java.util.Optional;

import com.tradeties.identity.MarketplaceUser;
import com.tradeties.identity.MarketplaceUsers;
import com.tradeties.identity.RegistrationIntent;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reading and registering the local user projection.
 *
 * <p>The one class in {@code identity.internal} that is public, because the controller in
 * the module's API package calls it. Spring Modulith still keeps it out of reach of other
 * modules — {@code ModularityTests} fails the build if one reaches in here.
 */
@Service
public class IdentityService implements MarketplaceUsers {

	private final UserAccountRepository repository;
	private final UserRegistration registration;

	IdentityService(UserAccountRepository repository, UserRegistration registration) {
		this.repository = repository;
		this.registration = registration;
	}

	/**
	 * @return the registered user behind this WorkOS id, or empty if they have authenticated
	 *         but never registered. Empty is a normal answer, not an error.
	 */
	@Override
	@Transactional(readOnly = true)
	public Optional<MarketplaceUser> findByWorkosUserId(String workosUserId) {
		return repository.findByWorkosUserId(workosUserId).map(UserAccount::toMarketplaceUser);
	}

	/**
	 * Registers the caller, or grants the intent's roles if they are already registered.
	 *
	 * <p>The retry covers one specific race: two sign-ins for the same person arriving at
	 * once. Both find no row, both insert, and the unique index on {@code workos_user_id}
	 * rejects the loser. Retrying is correct rather than hopeful — by the time the exception
	 * is thrown the winner has committed, so the second attempt is guaranteed to find the row
	 * and take the grant-only path. It cannot loop.
	 */
	public MarketplaceUser register(String workosUserId, String email, RegistrationIntent intent) {
		try {
			return registration.register(workosUserId, email, intent);
		}
		catch (DataIntegrityViolationException lostTheInsertRace) {
			return registration.register(workosUserId, email, intent);
		}
	}
}