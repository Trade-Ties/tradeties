package com.tradeties.identity;

import java.util.List;
import java.util.Set;

import com.tradeties.generated.api.IdentityApi;
import com.tradeties.generated.model.CurrentUser;
import com.tradeties.generated.model.MarketplaceRole;
import com.tradeties.generated.model.RegistrationRequest;
import com.tradeties.identity.internal.IdentityService;
import com.tradeties.platform.security.CurrentPrincipal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.RestController;

/**
 * Implements the generated {@code IdentityApi} interface. Because that interface is
 * generated from {@code api/openapi.yaml}, any drift between contract and code is a
 * compile error rather than a runtime surprise for the frontend.
 */
@RestController
class IdentityController implements IdentityApi {

	private final CurrentPrincipal currentPrincipal;
	private final IdentityService identityService;

	IdentityController(CurrentPrincipal currentPrincipal, IdentityService identityService) {
		this.currentPrincipal = currentPrincipal;
		this.identityService = identityService;
	}

	/**
	 * Read-only. A caller with a valid token who never registered is not an error and not a
	 * 404 — they exist, they simply hold no roles yet. Answering with empty roles is what
	 * lets the portal tell "signed in" and "registered" apart in one round trip.
	 */
	@Override
	public ResponseEntity<CurrentUser> getCurrentUser() {

		Jwt token = currentPrincipal.requireToken();

		CurrentUser user = identityService.findByWorkosUserId(token.getSubject())
				.map(IdentityController::toWire)
				.orElseGet(() -> unregistered(token));

		return ResponseEntity.ok(user);
	}

	/**
	 * The identity comes from the validated token, never from the request body — the body
	 * carries only which side of the marketplace the caller is joining. A client that could
	 * name the user id would be registering on someone else's behalf.
	 */
	@Override
	public ResponseEntity<CurrentUser> registerCurrentUser(RegistrationRequest registrationRequest) {

		Jwt token = currentPrincipal.requireToken();

		MarketplaceUser registered = identityService.register(
				token.getSubject(),
				token.getClaimAsString("email"),
				toDomain(registrationRequest.getIntent()));

		return ResponseEntity.ok(toWire(registered));
	}

	/** The token's own view of the caller: authenticated, but not a member of the marketplace. */
	private static CurrentUser unregistered(Jwt token) {
		return new CurrentUser()
				.userId(token.getSubject())
				.email(token.getClaimAsString("email"))
				.roles(List.of());
	}

	private static CurrentUser toWire(MarketplaceUser user) {
		return new CurrentUser()
				.userId(user.workosUserId())
				.email(user.email())
				.roles(toWire(user.roles()));
	}

	/**
	 * Mapped by name. {@code RoleContractTest} asserts every {@link Role} has a counterpart,
	 * so a contract edit that drops one fails the build instead of this {@code valueOf}.
	 */
	private static List<MarketplaceRole> toWire(Set<Role> roles) {
		return roles.stream()
				.map(role -> MarketplaceRole.valueOf(role.name()))
				.sorted()
				.toList();
	}

	private static RegistrationIntent toDomain(com.tradeties.generated.model.RegistrationIntent intent) {
		return RegistrationIntent.valueOf(intent.name());
	}
}