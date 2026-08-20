package com.tradeties;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * A registered tradesperson who owns one business — "Acme Plumbing" at the given slug. Shared
 * across the {@code business} and {@code availability} test suites, most of which only need this
 * as a starting point for the endpoint they are actually testing, not as something to build by
 * hand in every test class.
 */
public final class BusinessFixtures {

	private BusinessFixtures() {
	}

	/** Registers {@code subject} as a tradesperson and gives them a business at {@code slug}. */
	public static RequestPostProcessor businessFor(MockMvc mockMvc, String subject, String slug) throws Exception {
		RequestPostProcessor token = jwt().jwt(t -> t.subject(subject).claim("email", subject + "@example.com"));

		mockMvc.perform(post("/api/v1/me/registration").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"intent":"TRADESPERSON"}"""))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(businessJson(slug, "")))
				.andExpect(status().isCreated());

		return token;
	}

	/**
	 * The "Acme Plumbing" business body, with {@code extraFields} spliced in ahead of {@code slug}
	 * — e.g. {@code "\"version\": 99,"} for the tests that submit a stale or duplicate version.
	 */
	public static String businessJson(String slug, String extraFields) {
		return """
				{
				  %s
				  "slug": "%s",
				  "legalName": "Acme Plumbing LLC",
				  "displayName": "Acme Plumbing",
				  "phone": "+13035550101",
				  "email": "dispatch@acme.example",
				  "address": {
				    "street1": "123 Main St",
				    "city": "Denver",
				    "state": "CO",
				    "postalCode": "80202"
				  },
				  "timeZone": "America/Denver",
				  "serviceRadiusMiles": 25
				}""".formatted(extraFields, slug);
	}

	/**
	 * The same "Acme Plumbing" business, inserted directly with JDBC rather than through the API
	 * — for tests exercising a repository or an insert-race below the controller layer, where
	 * going through {@link #businessFor} would test the API path the test isn't about.
	 *
	 * @return the id of the row inserted into {@code business_profile}
	 */
	public static UUID givenABusiness(JdbcTemplate jdbc, String slug, String subject) {
		UUID userId = UUID.randomUUID();
		jdbc.update("""
				INSERT INTO identity_user (id, workos_user_id, email, created_at, updated_at, version)
				VALUES (?, ?, ?, now(), now(), 0)""", userId, subject, subject + "@example.com");

		UUID businessId = UUID.randomUUID();
		jdbc.update("""
				INSERT INTO business_profile (id, owner_user_id, slug, legal_name, display_name, phone,
					email, street1, city, state, postal_code, time_zone, service_radius_miles, status,
					onboarding_completed_step, created_at, updated_at, version)
				VALUES (?, ?, ?, 'Acme Plumbing LLC', 'Acme Plumbing', '+13035550101',
					'dispatch@acme.example', '123 Main St', 'Denver', 'CO', '80202', 'America/Denver',
					25, 'DRAFT', 2, now(), now(), 0)""", businessId, userId, slug);

		return businessId;
	}
}
