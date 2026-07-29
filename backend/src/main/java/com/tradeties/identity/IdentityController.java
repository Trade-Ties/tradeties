package com.tradeties.identity;

import java.util.List;

import com.tradeties.generated.api.IdentityApi;
import com.tradeties.generated.model.CurrentUser;
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

	IdentityController(CurrentPrincipal currentPrincipal) {
		this.currentPrincipal = currentPrincipal;
	}

	@Override
	public ResponseEntity<CurrentUser> getCurrentUser() {

		Jwt token = currentPrincipal.requireToken();

		CurrentUser user = new CurrentUser()
				.userId(token.getSubject())
				.email(token.getClaimAsString("email"))
				// Roles come from the local user projection, which the first feature
				// slice introduces. Until then the contract is honoured with an empty
				// list rather than a guess derived from WorkOS claims.
				.roles(List.of());

		return ResponseEntity.ok(user);
	}
}
