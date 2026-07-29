package com.tradeties.platform.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Access to the caller's WorkOS token.
 *
 * <p>Exists because controllers implement generated interfaces whose signatures come
 * from the OpenAPI contract — the contract describes the HTTP payload, so there is no
 * parameter to inject the principal into. Reading it from the security context here
 * keeps that plumbing in one place instead of scattering
 * {@code SecurityContextHolder} calls through the domain modules.
 */
@Component
public class CurrentPrincipal {

	/**
	 * @return the validated access token of the current request
	 * @throws IllegalStateException if called outside an authenticated request — a bug,
	 *         not a user error: every endpoint is authenticated by default.
	 */
	public Jwt requireToken() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		if (authentication instanceof JwtAuthenticationToken token) {
			return token.getToken();
		}

		throw new IllegalStateException(
				"No authenticated JWT in the security context. Did an endpoint get exposed without authentication?");
	}

	/** @return the WorkOS user id ({@code user_...}) of the caller */
	public String requireUserId() {
		return requireToken().getSubject();
	}
}
