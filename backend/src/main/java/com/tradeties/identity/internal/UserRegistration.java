package com.tradeties.identity.internal;

import com.tradeties.identity.MarketplaceUser;
import com.tradeties.identity.RegistrationIntent;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The transactional half of registration, split from {@link IdentityService} so the retry
 * there can start a <em>new</em> transaction. Catching a constraint violation inside the
 * transaction that caused it is pointless — it is already marked rollback-only.
 */
@Component
class UserRegistration {

	private final UserAccountRepository repository;

	UserRegistration(UserAccountRepository repository) {
		this.repository = repository;
	}

	/**
	 * Find-or-create, then grant. Idempotent: the portal re-posts this on every sign-in, so
	 * the second and every later call must be a no-op that still returns the current state.
	 *
	 * <p>Public despite the package-private class: Spring's proxying only reliably advises
	 * public methods, and a {@code @Transactional} that silently does nothing is the kind of
	 * bug that surfaces as corrupt data months later.
	 */
	@Transactional
	public MarketplaceUser register(String workosUserId, String email, RegistrationIntent intent) {

		UserAccount account = repository.findByWorkosUserId(workosUserId)
				.orElseGet(() -> new UserAccount(workosUserId, email));

		account.updateEmail(email);
		account.grant(intent.grants());

		return repository.save(account).toMarketplaceUser();
	}
}