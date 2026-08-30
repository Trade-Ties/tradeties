package com.tradeties;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;

import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
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

	public static RequestPostProcessor businessFor(MockMvc mockMvc, String subject, String slug) throws Exception {
		RequestPostProcessor token = registeredTradesperson(mockMvc, subject);

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(businessJson(slug, "")))
				.andExpect(status().isCreated());

		return token;
	}

	/**
	 * The registration half of {@link #businessFor}, for the tests that need to create the
	 * business themselves — with a postal code of their own, most of them.
	 *
	 * <p>Separate rather than copied because this is the one step that touches identity: the day
	 * the registration body gains a field or the token gains a required claim, a copy fails with
	 * a 400 in a suite that has nothing to do with either.
	 */
	public static RequestPostProcessor registeredTradesperson(MockMvc mockMvc, String subject) throws Exception {
		RequestPostProcessor token = jwt().jwt(t -> t.subject(subject).claim("email", subject + "@example.com"));

		mockMvc.perform(post("/api/v1/me/registration").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"intent":"TRADESPERSON"}"""))
				.andExpect(status().isOk());

		return token;
	}

	/**
	 * A replacement of the whole profile that differs only in the postal code, with the stored
	 * version read first so it is accepted.
	 *
	 * <p>A request rather than a performed call, because the callers disagree about what should
	 * come back: a move onto an unplaceable code is refused on a live profile and stored on a
	 * draft, and each test asserts its own outcome.
	 */
	public static RequestBuilder moveRequest(MockMvc mockMvc, RequestPostProcessor token,
			String slug, String postalCode) throws Exception {

		String stored = mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		return put("/api/v1/me/business").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(businessJson(slug, postalCode,
						"\"version\": " + JsonPath.read(stored, "$.version") + ","));
	}

	/**
	 * Claims one trade as the primary one and returns its id.
	 *
	 * <p>Here rather than in each suite because a service now requires a trade, and most tests
	 * that create one are not about trades at all — they need step 3 answered so that step 4 can
	 * be reached, in one line and with an id they can file the service under.
	 *
	 * @param code a trade code from the reference catalogue, e.g. {@code "PLUMBER"}
	 * @return the catalogue id of that trade, which the business now holds as its primary
	 */
	public static String claimPrimaryTrade(MockMvc mockMvc, RequestPostProcessor token, String code)
			throws Exception {

		String tradeId = tradeId(mockMvc, code);

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"primaryTradeId":"%s","additionalTradeIds":[]}""".formatted(tradeId)))
				.andExpect(status().isOk());

		return tradeId;
	}

	/** Reads an id out of the live catalogue rather than hard-coding one from the migration. */
	public static String tradeId(MockMvc mockMvc, String code) throws Exception {
		String body = mockMvc.perform(get("/api/v1/trades"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		List<String> ids = JsonPath.read(body, "$[?(@.code=='" + code + "')].id");
		if (ids.isEmpty()) {
			throw new IllegalStateException("No trade " + code + " in the catalogue");
		}

		return ids.getFirst();
	}

	/**
	 * The "Acme Plumbing" business body, with {@code extraFields} spliced in ahead of {@code slug}
	 * — e.g. {@code "\"version\": 99,"} for the tests that submit a stale or duplicate version.
	 */
	public static String businessJson(String slug, String extraFields) {
		return businessJson(slug, "80202", extraFields);
	}

	/**
	 * The same body with the postal code varied, which is the one field the geocoding suites need
	 * to change — a ZIP+4, a code with no centroid, a move to the next town.
	 */
	public static String businessJson(String slug, String postalCode, String extraFields) {
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
				    "postalCode": "%s"
				  },
				  "timeZone": "America/Denver",
				  "serviceRadiusMiles": 25
				}""".formatted(extraFields, slug, postalCode);
	}

	/**
	 * A service body for step 4, with {@code extraFields} spliced in ahead of the trade — e.g.
	 * {@code "\"version\": 99,"} for the tests that submit a stale version.
	 *
	 * <p>Here rather than in each suite for the reason {@link #claimPrimaryTrade} is: a new
	 * required field would otherwise cost an edit in every hand-written copy of this body.
	 *
	 * @param tradeId null to leave the field out entirely, for the tests about it being required
	 * @param price null for a mode that carries no amount
	 */
	public static String serviceJson(String extraFields, String name, String tradeId,
			String pricingMode, String price) {

		return """
				{
				  %s
				  %s
				  "name": "%s",
				  "estimatedDurationMinutes": 60,
				  "pricingMode": "%s"%s
				}""".formatted(
				extraFields,
				tradeId == null ? "" : "\"tradeId\": \"" + tradeId + "\",",
				name,
				pricingMode,
				price == null ? "" : ",\n  \"price\": \"" + price + "\"");
	}

	/**
	 * Claims {@code PLUMBER} and files one quote-only service under it, for the suites whose
	 * subject is a service's id, its position or its removal rather than which trade it sits under.
	 *
	 * <p>The claim is repeated per call rather than hoisted, because the endpoint replaces the
	 * whole selection with the same one trade: sending it again is the same state, and having it
	 * here means no test has to remember to set it up.
	 *
	 * @return the id of the service created
	 */
	public static String givenAService(MockMvc mockMvc, RequestPostProcessor token, String name)
			throws Exception {

		String plumber = claimPrimaryTrade(mockMvc, token, "PLUMBER");

		String body = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("", name, plumber, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		return JsonPath.read(body, "$.id");
	}

	/**
	 * The same business taken all the way to publishable: a primary trade, a week of working
	 * hours, one service and a set of rates, so that every line of the checklist passes.
	 *
	 * <p>Here rather than in one suite because two of them now start from it — the checklist and
	 * the slug freeze — and a second copy is the one that quietly stops matching the checklist it
	 * is supposed to satisfy.
	 */
	public static RequestPostProcessor publishableBusinessFor(MockMvc mockMvc, String subject,
			String slug) throws Exception {

		return publishableBusinessFor(mockMvc, subject, slug, "PLUMBER");
	}

	/**
	 * The same, under a trade of the caller's choosing — for the search, where what separates two
	 * fixtures is which trade they offer.
	 */
	public static RequestPostProcessor publishableBusinessFor(MockMvc mockMvc, String subject,
			String slug, String tradeCode) throws Exception {

		RequestPostProcessor token = businessFor(mockMvc, subject, slug);
		String trade = claimTradeAndHours(mockMvc, token, tradeCode);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("", "Clog removal", trade, "STARTING_AT", "149.00")))
				.andExpect(status().isCreated());

		setPricing(mockMvc, token, null);

		return token;
	}

	/**
	 * Steps 3 and 8 — the two the checklist wants that say nothing about a service.
	 *
	 * @return the id of the trade now claimed, which the services filed afterwards sit under
	 */
	public static String claimTradeAndHours(MockMvc mockMvc, RequestPostProcessor token)
			throws Exception {

		return claimTradeAndHours(mockMvc, token, "PLUMBER");
	}

	/** The same two steps, under a named trade. */
	public static String claimTradeAndHours(MockMvc mockMvc, RequestPostProcessor token,
			String tradeCode) throws Exception {

		String trade = claimPrimaryTrade(mockMvc, token, tradeCode);

		StringBuilder days = new StringBuilder();
		for (int day = 1; day <= 7; day++) {
			days.append(day == 1 ? "" : ",")
					.append("{\"dayOfWeek\":").append(day).append(",\"blocks\":")
					.append(day == 1 ? "[{\"startsAt\":\"09:00\",\"endsAt\":\"17:00\"}]" : "[]")
					.append("}");
		}

		mockMvc.perform(put("/api/v1/me/business/working-hours").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"days\":[" + days + "]}"))
				.andExpect(status().isOk());

		return trade;
	}

	/**
	 * Sets rates, creating them the first time and replacing them afterwards. Which of the two it
	 * is has to come from the status: a business without rates answers 404 with a problem body,
	 * which is neither blank nor carries a version.
	 */
	public static void setPricing(MockMvc mockMvc, RequestPostProcessor token, String hourlyRate)
			throws Exception {

		var response = mockMvc.perform(get("/api/v1/me/business/pricing").with(token))
				.andReturn().getResponse();

		Integer version = response.getStatus() == 200
				? JsonPath.read(response.getContentAsString(), "$.version")
				: null;

		mockMvc.perform(put("/api/v1/me/business/pricing").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{%s%s"minimumBillableMinutes":60,"billingIncrementMinutes":15,
								 "serviceCallFeeWaivedIfHired":false,"travelFeeMode":"INCLUDED",
								 "materialPricingMode":"INCLUDED","cancellationFee":"50.00",
								 "cancellationNoticeHours":24}"""
								.formatted(
										version == null ? "" : "\"version\":" + version + ",",
										hourlyRate == null ? "" : "\"hourlyRate\":\"" + hourlyRate + "\",")))
				.andExpect(status().isOk());
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
