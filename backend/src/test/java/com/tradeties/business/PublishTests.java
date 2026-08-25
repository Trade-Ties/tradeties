package com.tradeties.business;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 *
 * <p>The profile URL is moved by the same call and is not here: see {@link SlugFreezeTests}.
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
		String plumber = BusinessFixtures.claimTradeAndHours(mockMvc, token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.serviceJson("", "Call-out", plumber, "HOURLY", null)))
				.andExpect(status().isCreated());

		BusinessFixtures.setPricing(mockMvc, token, null);

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(check(2, "HOURLY_SERVICES_HAVE_A_RATE", false));

		BusinessFixtures.setPricing(mockMvc, token, "125.00");

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(check(2, "HOURLY_SERVICES_HAVE_A_RATE", true))
				.andExpect(jsonPath("$.ready").value(true));
	}

	/**
	 * The invariant a live profile carries: findable and bookable are one state.
	 *
	 * <p>Giving up a trade retires the services filed under it, and the last of those is the last
	 * thing anybody could have booked. Refused rather than applied and quietly unpublished — going
	 * dark is not what changing a trade asked for — and the transaction rolling back is what puts
	 * the catalogue back.
	 */
	@Test
	void aLiveProfileCannotBeLeftWithNothingToBook() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_would_go_dark", "would-go-dark");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(onlyPrimary("ROOFER")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail").value(containsString("live")));

		// `active` as well as the count, because the two ways a service can leave the catalogue
		// leave different traces: a retired one drops out of this list, a deactivated one stays
		// in it saying so. Counting alone would call a leaked deactivation a clean rollback.
		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].active").value(true));
		mockMvc.perform(get("/api/v1/me/business/trades").with(token))
				.andExpect(jsonPath("$.primary.code").value("PLUMBER"));
		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.status").value("PUBLISHED"));
	}

	/**
	 * The other half of that rule, and why the checklist is read before the change as well as
	 * after. A live profile already failing it is somebody on their way to putting it right, and
	 * refusing their edits would leave them nowhere to do it from.
	 */
	@Test
	void aLiveProfileAlreadyFailingTheChecklistIsNotHeldToIt() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_already_dark", "already-dark");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		jdbcTemplate.update("""
				UPDATE business_service SET active = FALSE
				WHERE business_id = (SELECT id FROM business_profile WHERE slug = 'already-dark')""");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(onlyPrimary("ROOFER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.primary.code").value("ROOFER"));
	}

	/**
	 * Removing the last thing anybody can book is a decision about being listed at all, so it is
	 * put to the holder rather than either refused or taken quietly.
	 *
	 * <p>Deliberately the opposite answer to the one a trade change gets two tests up. Giving up a
	 * trade is not a request to stop trading; this is.
	 */
	@Test
	void removingTheLastServiceOfALiveProfileIsAskedAboutFirst() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_last_service", "last-service");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		mockMvc.perform(delete("/api/v1/me/business/services/" + onlyService(token)).with(token))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.type").value("urn:tradeties:problem:unconfirmed-unpublish"))
				.andExpect(jsonPath("$.detail").value(containsString("only service")));

		// Refused whole: the question is not a half-applied removal.
		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].active").value(true));
		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.status").value("PUBLISHED"));
	}

	/** The same request with the answer attached, which is the whole of what the client adds. */
	@Test
	void confirmingTakesTheProfileOffTheMarketWithTheService() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_confirms_offline", "confirms-offline");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		mockMvc.perform(delete("/api/v1/me/business/services/" + onlyService(token)).with(token)
						.param("unpublishConfirmed", "true"))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(jsonPath("$.length()").value(0));
		mockMvc.perform(get("/api/v1/me/business").with(token))
				// A draft again, and everything else it holds is still there — publishing again is
				// one call away, which is what the question promised.
				.andExpect(jsonPath("$.status").value("DRAFT"));
	}

	/** The other half of the rule: it is the last one that is asked about, not any one. */
	@Test
	void removingOneOfSeveralServicesFromALiveProfileAsksNothing() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_spare_service", "spare-service");
		String plumber = BusinessFixtures.tradeId(mockMvc, "PLUMBER");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"tradeId":"%s","name":"Drain snake","estimatedDurationMinutes":60,
								 "pricingMode":"QUOTE_ONLY"}""".formatted(plumber)))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		String first = JsonPath.read(mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andReturn().getResponse().getContentAsString(), "$[0].id");

		mockMvc.perform(delete("/api/v1/me/business/services/" + first).with(token))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.status").value("PUBLISHED"));
	}

	/** The id of the one service `completeBusinessFor` leaves behind. */
	private String onlyService(RequestPostProcessor token) throws Exception {
		return JsonPath.read(mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andReturn().getResponse().getContentAsString(), "$[0].id");
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

	/** A whole step 3 naming one trade, which is what drops every other trade the business held. */
	private String onlyPrimary(String code) throws Exception {
		return """
				{"primaryTradeId":"%s","additionalTradeIds":[]}"""
				.formatted(BusinessFixtures.tradeId(mockMvc, code));
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

	/** Registers, creates the draft, and takes it all the way to publishable. */
	private RequestPostProcessor completeBusinessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
