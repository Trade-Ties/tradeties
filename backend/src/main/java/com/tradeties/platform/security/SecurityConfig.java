package com.tradeties.platform.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The API is a stateless OAuth2 resource server in front of WorkOS AuthKit.
 *
 * <p>Deliberately minimal: this class answers "is this token genuine and unexpired",
 * nothing more. <em>Authorization</em> — who may see which job request, who belongs to
 * which business — is domain logic and belongs in the modules that own that data, not
 * in a central rule table here.
 */
@Configuration
@EnableWebSecurity
class SecurityConfig {

	/**
	 * Actuator: liveness/readiness must stay reachable for Traefik and, later, the
	 * container orchestrator. Everything else under /actuator stays closed.
	 */
	@Bean
	@Order(1)
	SecurityFilterChain actuatorFilterChain(HttpSecurity http) throws Exception {
		return http
				.securityMatcher("/actuator/**")
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
						.anyRequest().denyAll())
				.csrf(AbstractHttpConfigurer::disable)
				.build();
	}

	/**
	 * Catch-all chain: every other request needs a valid WorkOS access token.
	 * Denying by default means a new endpoint is never accidentally public.
	 *
	 * <p>The reference catalogues are the first deliberate exception: lists of trades, of US
	 * states and of time zones, which the customer-side search reads without a token. The search
	 * itself is the second — {@code GET /api/v1/businesses} is the demand side of the marketplace,
	 * and DECISIONS section 1 has it working for somebody who has never signed in. It answers with
	 * business names, towns, distances, hourly rates, two licence flags and the start times each
	 * business is next free; nothing in it names a person.
	 *
	 * <p>Listed one path at a time rather than as {@code /api/v1/reference/**} or a prefix, so
	 * that opening the next one is a decision somebody has to write down here. The GET is part of
	 * the rule: {@code /api/v1/businesses} is public to read and has no other method.
	 *
	 * <p>All four carry {@code security: []} in {@code api/openapi.yaml}. That declaration
	 * documents the exception; this line is what actually makes it.
	 */
	@Bean
	@Order(2)
	SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
		return http
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.GET,
								"/api/v1/trades", "/api/v1/us-states", "/api/v1/time-zones",
								"/api/v1/businesses")
						.permitAll()
						.anyRequest().authenticated())
				.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				// No cookies, no sessions — a bearer-token API cannot be CSRF'd.
				.csrf(AbstractHttpConfigurer::disable)
				.build();
	}

	/**
	 * Validates the signature against the client-scoped JWKS, and the {@code iss} claim
	 * against the client-scoped issuer. Both are bound to this application's client id, so
	 * a token minted for another WorkOS application fails on either count.
	 *
	 * <p><strong>Corrected.</strong> This class was written on the assumption that WorkOS
	 * issues every tenant's tokens under one shared {@code https://api.workos.com}, making
	 * the JWKS URL the only thing that identified the application. That is wrong for AuthKit
	 * access tokens: the issuer is {@code https://api.workos.com/user_management/<client_id>}.
	 * Both values now derive from {@code WORKOS_CLIENT_ID} so they cannot drift apart.
	 *
	 * <p>WorkOS <em>does</em> serve OIDC discovery, at
	 * {@code /user_management/<client_id>/.well-known/openid-configuration} — the second
	 * incorrect assumption behind building this decoder by hand. Setting
	 * {@code spring.security.oauth2.resourceserver.jwt.issuer-uri} would let Spring read both
	 * values from that document and delete this bean, which is the simplification to make
	 * once the flow is confirmed working end to end.
	 */
	@Bean
	JwtDecoder jwtDecoder(
			@Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkSetUri,
			@Value("${workos.issuer}") String issuer) {

		NimbusJwtDecoder decoder = NimbusJwtDecoder
				.withJwkSetUri(jwkSetUri)
				.build();

		OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
				JwtValidators.createDefault(),
				new JwtIssuerValidator(issuer));

		decoder.setJwtValidator(validator);
		return decoder;
	}
}
