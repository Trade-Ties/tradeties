package com.tradeties.platform.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
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
	 */
	@Bean
	@Order(2)
	SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
		return http
				.authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
				.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				// No cookies, no sessions — a bearer-token API cannot be CSRF'd.
				.csrf(AbstractHttpConfigurer::disable)
				.build();
	}

	/**
	 * Built by hand rather than by auto-configuration for one reason: WorkOS issues
	 * every tenant's tokens under the same {@code iss} ({@code https://api.workos.com}),
	 * so the issuer alone proves nothing. What binds a token to <em>this</em> application
	 * is the client-scoped JWKS URL. We validate both.
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
