package com.tradeties.identity;

import java.util.Optional;

import com.tradeties.platform.security.CurrentPrincipal;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * The caller's own {@link MarketplaceUser}, resolved from the request's WorkOS token.
 *
 * <p>Every module that guards a write behind "the caller must be a tradesperson" was
 * repeating the same three steps: read the token off {@link CurrentPrincipal}, resolve it
 * through {@link MarketplaceUsers}, and check the role. Centralized here so that mechanism —
 * and the wording of the 403 it produces — stays in one place as more modules add the same
 * guard, instead of drifting between copies.
 */
@Component
public class CurrentMarketplaceUser {

	private final CurrentPrincipal currentPrincipal;
	private final MarketplaceUsers marketplaceUsers;

	CurrentMarketplaceUser(CurrentPrincipal currentPrincipal, MarketplaceUsers marketplaceUsers) {
		this.currentPrincipal = currentPrincipal;
		this.marketplaceUsers = marketplaceUsers;
	}

	/** @return the caller's local user, or empty if they authenticated but never registered */
	public Optional<MarketplaceUser> resolve() {
		return marketplaceUsers.findByWorkosUserId(currentPrincipal.requireUserId());
	}

	/**
	 * Writing requires the role, not just a token: letting a customer account act as one
	 * would leave an owner who cannot act on what they own.
	 *
	 * @return the caller's local user
	 * @throws ResponseStatusException 403 if they never registered, or registered without a
	 *         tradesperson role
	 */
	public MarketplaceUser requireTradesperson() {
		MarketplaceUser user = resolve().orElseThrow(CurrentMarketplaceUser::notATradesperson);

		if (!user.isTradesperson()) {
			throw notATradesperson();
		}

		return user;
	}

	private static ResponseStatusException notATradesperson() {
		return new ResponseStatusException(HttpStatus.FORBIDDEN, "This account is not registered as a tradesperson");
	}
}
