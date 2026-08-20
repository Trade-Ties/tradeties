package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Onboarding step 9 — the checklist, and the two moves it guards.
 *
 * <p>Everything checked here reads from at least two tables, which is exactly why none of it
 * is a database constraint.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PublishTests {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/**
	 * Except one: with no hourly services there is none missing a rate, so that check is
	 * vacuously true. Asserting it explicitly is the point — a checklist that failed
	 * conditions nobody has run into would be noise, and it is easy to write it the wrong way
	 * round.
	 */
	@Test
	void aFreshDraftFailsEveryCheckThatCanFail() throws Exception {
		RequestPostProcessor token = businessFor("user_fresh_draft", "fresh-draft");

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.ready").value(false))
				.andExpect(jsonPath("$.checks.length()").value(5))
				.andExpect(check(0, "PRIMARY_TRADE", false))
				.andExpect(check(1, "AT_LEAST_ONE_SERVICE", false))
				.andExpect(check(2, "HOURLY_SERVICES_HAVE_A_RATE", true))
				.andExpect(check(3, "PRICING_SET", false))
				.andExpect(check(4, "WORKING_HOURS_SET", false));
	}

	@Test
	void publishingAnIncompleteProfileIsRefusedWithTheChecklist() throws Exception {
		RequestPostProcessor token = businessFor("user_too_early", "too-early");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.ready").value(false))
				.andExpect(jsonPath("$.checks[0].code").value("PRIMARY_TRADE"))
				.andExpect(jsonPath("$.checks[0].detail").isNotEmpty());

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.status").value("DRAFT"));
	}

	@Test
	void aCompleteProfileGoesLive() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_goes_live", "goes-live");

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.ready").value(true));

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("PUBLISHED"))
				.andExpect(jsonPath("$.onboardingCompletedStep").value(9));
	}

	@Test
	void publishingTwiceIsHarmless() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_publishes_twice", "publishes-twice");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("PUBLISHED"));
	}

	/**
	 * The reason the checklist is re-run inside the publish transaction: between the read
	 * that greys out the button and the call itself, the same tradesperson can pull the rug
	 * out in another tab.
	 */
	@Test
	void theChecklistIsReEvaluatedAtPublishTime() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_changes_mind", "changes-mind");

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(jsonPath("$.ready").value(true));

		jdbcTemplate.update("""
				UPDATE business_service SET active = FALSE
				WHERE business_id = (SELECT id FROM business_profile WHERE slug = 'changes-mind')""");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(check(1, "AT_LEAST_ONE_SERVICE", false));
	}

	/**
	 * The rule that spans two tables: an hourly service without its own rate is fine as long
	 * as the business has a general one.
	 */
	@Test
	void anHourlyServiceWithoutARateBlocksPublishingUntilOneExists() throws Exception {
		RequestPostProcessor token = businessFor("user_hourly", "hourly");
		setUpTradeAndHours(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"Call-out","estimatedDurationMinutes":60,"pricingMode":"HOURLY"}"""))
				.andExpect(status().isCreated());

		setPricing(token, null);

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(check(2, "HOURLY_SERVICES_HAVE_A_RATE", false));

		setPricing(token, "125.00");

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(check(2, "HOURLY_SERVICES_HAVE_A_RATE", true))
				.andExpect(jsonPath("$.ready").value(true));
	}

	@Test
	void aPublishedProfileCanGoBackToADraft() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_goes_back", "goes-back");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/unpublish").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DRAFT"))
				// The wizard was completed; going offline does not undo that.
				.andExpect(jsonPath("$.onboardingCompletedStep").value(9));
	}

	@Test
	void unpublishingADraftIsHarmless() throws Exception {
		RequestPostProcessor token = businessFor("user_already_draft", "already-draft");

		mockMvc.perform(post("/api/v1/me/business/unpublish").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DRAFT"));
	}

	/** Suspension is the marketplace's state, not the holder's to step out of. */
	@Test
	void aSuspendedProfileCannotBeTakenBackByItsHolder() throws Exception {
		RequestPostProcessor token = businessFor("user_suspended", "suspended");

		jdbcTemplate.update("UPDATE business_profile SET status = 'SUSPENDED' WHERE slug = 'suspended'");

		mockMvc.perform(post("/api/v1/me/business/unpublish").with(token))
				.andExpect(status().isConflict());
	}

	/**
	 * Publishing looks like the opposite move to unpublishing and lands in the same place:
	 * a profile the marketplace switched off, visible again. The rule is about the state, not
	 * about the direction.
	 *
	 * <p>Deliberately built with {@code completeBusinessFor} rather than {@code businessFor}.
	 * A fresh draft would fail its checklist first and answer 422, and this test would then be
	 * green for a reason that has nothing to do with the suspension.
	 */
	@Test
	void aSuspendedProfileCannotPublishItselfBackOnline() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_suspended_publish", "suspended-publish");

		jdbcTemplate.update(
				"UPDATE business_profile SET status = 'SUSPENDED' WHERE slug = 'suspended-publish'");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isConflict());

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.status").value("SUSPENDED"));
	}

	/** Registers, creates the draft, and takes it all the way to publishable. */
	private RequestPostProcessor completeBusinessFor(String subject, String slug) throws Exception {
		RequestPostProcessor token = businessFor(subject, slug);
		setUpTradeAndHours(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"Clog removal","estimatedDurationMinutes":60,
								 "pricingMode":"STARTING_AT","price":"149.00"}"""))
				.andExpect(status().isCreated());

		setPricing(token, null);

		return token;
	}

	private void setUpTradeAndHours(RequestPostProcessor token) throws Exception {
		String catalogue = mockMvc.perform(get("/api/v1/trades"))
				.andReturn().getResponse().getContentAsString();
		List<String> plumber = JsonPath.read(catalogue, "$[?(@.code=='PLUMBER')].id");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"primaryTradeId":"%s","additionalTradeIds":[]}""".formatted(plumber.getFirst())))
				.andExpect(status().isOk());

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
	}

	/**
	 * Asserts one line of the checklist by position.
	 *
	 * <p>By index rather than by a JsonPath filter, because the order is deliberate — it
	 * follows the wizard — and pinning it is worth more than the flexibility. A checklist
	 * whose lines moved around between calls would be a poor thing to render.
	 */
	private static org.springframework.test.web.servlet.ResultMatcher check(
			int index, String code, boolean expectedToPass) {

		return org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath(
				"$.checks[" + index + "]",
				org.hamcrest.Matchers.allOf(
						org.hamcrest.Matchers.hasEntry("code", (Object) code),
						org.hamcrest.Matchers.hasEntry("passed", (Object) expectedToPass)));
	}

	/**
	 * Sets rates, creating them the first time and replacing them afterwards. Which of the
	 * two it is has to come from the status: a business without rates answers 404 with a
	 * problem body, which is neither blank nor carries a version.
	 */
	private void setPricing(RequestPostProcessor token, String hourlyRate) throws Exception {
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

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
