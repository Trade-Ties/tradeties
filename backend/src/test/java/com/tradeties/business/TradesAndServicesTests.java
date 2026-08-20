package com.tradeties.business;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Onboarding steps 3 and 4, which are tested together because the schema ties them together:
 * a service may only sit under a trade the business actually holds, and a composite foreign
 * key enforces it.
 *
 * <p>Each test uses its own WorkOS subject and its own slug, so nothing needs cleaning up.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TradesAndServicesTests {

	@Autowired
	MockMvc mockMvc;

	@Test
	void aFreshProfileHoldsNoTrades() throws Exception {
		RequestPostProcessor token = businessFor("user_no_trades", "no-trades");

		mockMvc.perform(get("/api/v1/me/business/trades").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.primary").doesNotExist())
				.andExpect(jsonPath("$.additional.length()").value(0));
	}

	@Test
	void choosingTradesStoresAPrimaryAndTheRest() throws Exception {
		RequestPostProcessor token = businessFor("user_picks_trades", "picks-trades");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(tradeId("PLUMBER"), tradeId("ROOFER"), tradeId("PAINTER"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.primary.code").value("PLUMBER"))
				.andExpect(jsonPath("$.additional.length()").value(2));
	}

	/**
	 * The partial unique index allows one primary trade per business, so moving the flag has
	 * to clear the old one before setting the new one. If that ordering were wrong this test
	 * would fail with a constraint violation rather than a wrong answer.
	 */
	@Test
	void thePrimaryTradeCanBeMoved() throws Exception {
		RequestPostProcessor token = businessFor("user_moves_primary", "moves-primary");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(tradeId("PLUMBER"), tradeId("ROOFER"))))
				.andExpect(status().isOk());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(tradeId("ROOFER"), tradeId("PLUMBER"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.primary.code").value("ROOFER"));
	}

	@Test
	void thePrimaryTradeMustNotRepeatAmongTheOthers() throws Exception {
		RequestPostProcessor token = businessFor("user_repeats_trade", "repeats-trade");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(tradeId("PLUMBER"), tradeId("PLUMBER"))))
				.andExpect(status().isBadRequest());
	}

	@Test
	void anUnknownTradeIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_unknown_trade", "unknown-trade");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson("00000000-0000-4000-8000-000000000000")))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The one that would break silently. {@code business_service} points at
	 * {@code business_trade} with {@code ON DELETE SET NULL (trade_id)}, so replacing the
	 * selection by deleting every link and re-inserting it would unfile every service —
	 * including those under trades the tradesperson kept.
	 */
	@Test
	void changingTheTradesKeepsServicesFiledUnderTheOnesThatStay() throws Exception {
		RequestPostProcessor token = businessFor("user_keeps_filing", "keeps-filing");
		String plumber = tradeId("PLUMBER");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber, tradeId("ROOFER"))))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Clog removal", plumber, "STARTING_AT", "149.00")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.tradeId").value(plumber));

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber, tradeId("PAINTER"))))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].tradeId").value(plumber));
	}

	@Test
	void aServiceMustSitUnderATradeTheBusinessHolds() throws Exception {
		RequestPostProcessor token = businessFor("user_wrong_trade", "wrong-trade");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(tradeId("PLUMBER"))))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Rewire", tradeId("ELECTRICIAN"), "FLAT", "900.00")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void aCrossTradeServiceNeedsNoTrade() throws Exception {
		RequestPostProcessor token = businessFor("user_cross_trade", "cross-trade");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Emergency call-out", null, "HOURLY", "195.00")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.tradeId").doesNotExist())
				.andExpect(jsonPath("$.price").value("195.0000"));
	}

	/**
	 * The rule lives only in a database CHECK — the contract cannot express "required for
	 * these modes, forbidden for that one". Without the service-level check this arrives as
	 * a constraint violation and gets blamed on the service name.
	 */
	@Test
	void quoteOnlyMustNotCarryAPrice() throws Exception {
		RequestPostProcessor token = businessFor("user_quote_price", "quote-price");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Leak diagnosis", null, "QUOTE_ONLY", "150.00")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void aFlatPriceIsMandatory() throws Exception {
		RequestPostProcessor token = businessFor("user_flat_no_price", "flat-no-price");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Water heater swap", null, "FLAT", null)))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The service price is the one amount with no gap between "real" and "slipped": a
	 * whole-house repipe genuinely is $28,000, and a $280 job typed wrong is $28,000 too. The
	 * ceiling therefore clears every real job rather than trying to tell the two apart.
	 */
	@Test
	void aRealisticallyLargeFlatPriceIsAccepted() throws Exception {
		RequestPostProcessor token = businessFor("user_big_job", "big-job");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Whole-house repipe", null, "FLAT", "28000.00")))
				.andExpect(status().isCreated());
	}

	@Test
	void aGrosslySlippedFlatPriceIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_slipped_job", "slipped-job");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Whole-house repipe", null, "FLAT", "2800000.00")))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The same width at a service price, and here it was worse than a 500. The insert reached
	 * the database, and the catch that translates a lost name race answered "a service called
	 * 'Huge' already exists" — about a name that was free, on a write that failed for a reason
	 * nobody was told.
	 */
	@Test
	void anAmountWiderThanTheColumnIsNotReportedAsADuplicateName() throws Exception {
		RequestPostProcessor token = businessFor("user_wide_price", "wide-price");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Huge", null, "FLAT", "99999999999999999999")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void twoServicesCannotShareANameEvenInDifferentCase() throws Exception {
		RequestPostProcessor token = businessFor("user_dup_service", "dup-service");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Clog removal", null, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("CLOG REMOVAL", null, "QUOTE_ONLY", null)))
				.andExpect(status().isConflict());
	}

	@Test
	void replacingWithAStaleVersionIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_stale_service", "stale-service");
		String serviceId = createService(token, "Drain snake");

		mockMvc.perform(put("/api/v1/me/business/services/" + serviceId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":99,"name":"Renamed","estimatedDurationMinutes":60,"pricingMode":"QUOTE_ONLY"}"""))
				.andExpect(status().isConflict());
	}

	@Test
	void removingAServiceTakesItOutOfTheList() throws Exception {
		RequestPostProcessor token = businessFor("user_removes_service", "removes-service");
		String serviceId = createService(token, "Temporary");

		mockMvc.perform(delete("/api/v1/me/business/services/" + serviceId).with(token))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void someoneElsesServiceIsIndistinguishableFromAMissingOne() throws Exception {
		RequestPostProcessor owner = businessFor("user_service_owner", "service-owner");
		String serviceId = createService(owner, "Private");

		RequestPostProcessor stranger = businessFor("user_service_stranger", "service-stranger");

		mockMvc.perform(delete("/api/v1/me/business/services/" + serviceId).with(stranger))
				.andExpect(status().isNotFound());
	}

	@Test
	void reorderingRewritesThePositions() throws Exception {
		RequestPostProcessor token = businessFor("user_reorders", "reorders");
		String first = createService(token, "First");
		String second = createService(token, "Second");

		mockMvc.perform(put("/api/v1/me/business/services/order").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"serviceIds":["%s","%s"]}""".formatted(second, first)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].name").value("Second"))
				.andExpect(jsonPath("$[1].name").value("First"));
	}

	/** A partial list would leave the remainder in an order nobody chose. */
	@Test
	void reorderingMustNameEveryActiveService() throws Exception {
		RequestPostProcessor token = businessFor("user_partial_order", "partial-order");
		String first = createService(token, "First");
		String second = createService(token, "Second");

		mockMvc.perform(put("/api/v1/me/business/services/order").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"serviceIds":["%s"]}""".formatted(first)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value(containsString(second)));
	}

	/**
	 * The case the old message could not describe at all: the right number of ids, one of them
	 * wrong. It answered "expected 2, got 2" — perfectly true, and no help in finding which.
	 */
	@Test
	void anOrderOfTheRightLengthWithAWrongIdNamesBothSides() throws Exception {
		RequestPostProcessor token = businessFor("user_wrong_id_order", "wrong-id-order");
		String first = createService(token, "First");
		String second = createService(token, "Second");
		String stranger = UUID.randomUUID().toString();

		mockMvc.perform(put("/api/v1/me/business/services/order").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"serviceIds":["%s","%s"]}""".formatted(first, stranger)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value(containsString(second)))
				.andExpect(jsonPath("$.detail").value(containsString(stranger)));
	}

	/**
	 * A position comes from the highest one in use, never from the count.
	 *
	 * <p>With three services at 10, 20 and 30 and the middle one deleted, a count of two would
	 * hand the newcomer 30 all over again. Nothing in the schema forbids that, so the two would
	 * simply share a position and PostgreSQL would decide their order — differently after the
	 * next update. The numbers are asserted rather than only the names, because a tie can put
	 * them in the right order by luck.
	 */
	@Test
	void aServiceAddedAfterADeletionDoesNotReuseAPosition() throws Exception {
		RequestPostProcessor token = businessFor("user_add_after_delete", "add-after-delete");
		createService(token, "First");
		String second = createService(token, "Second");
		createService(token, "Third");

		mockMvc.perform(delete("/api/v1/me/business/services/" + second).with(token))
				.andExpect(status().isNoContent());

		createService(token, "Fourth");

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3))
				.andExpect(jsonPath("$[0].name").value("First"))
				.andExpect(jsonPath("$[0].sortOrder").value(10))
				.andExpect(jsonPath("$[1].name").value("Third"))
				.andExpect(jsonPath("$[1].sortOrder").value(30))
				.andExpect(jsonPath("$[2].name").value("Fourth"))
				.andExpect(jsonPath("$[2].sortOrder").value(40));
	}

	/**
	 * The worse half of the same mistake, and the one that breaks a written promise.
	 *
	 * <p>Two deletions leave a count of one, which hands the newcomer 20 — in front of the
	 * survivor at 30. Not a tie this time but reliably wrong: {@code POST /services} says
	 * "appended to the end of the list", and it would not be.
	 */
	@Test
	void aServiceAddedAfterTwoDeletionsIsStillAppended() throws Exception {
		RequestPostProcessor token = businessFor("user_add_after_two", "add-after-two");
		String first = createService(token, "First");
		String second = createService(token, "Second");
		createService(token, "Third");

		mockMvc.perform(delete("/api/v1/me/business/services/" + first).with(token))
				.andExpect(status().isNoContent());
		mockMvc.perform(delete("/api/v1/me/business/services/" + second).with(token))
				.andExpect(status().isNoContent());

		createService(token, "Fourth");

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].name").value("Third"))
				.andExpect(jsonPath("$[1].name").value("Fourth"));
	}

	/**
	 * Reordering renumbers the whole catalogue, not just the half the client named.
	 *
	 * <p>A deactivated service left on its old number collides with whichever active one is
	 * moved onto it — here "Second" would keep 20 and "First" would be moved to 20 as well.
	 * They are listed together by {@code GET /services}, so the collision is visible, and the
	 * order of those two would be PostgreSQL's to decide.
	 */
	@Test
	void reorderingPutsDeactivatedServicesAfterTheActiveOnes() throws Exception {
		RequestPostProcessor token = businessFor("user_reorder_inactive", "reorder-inactive");
		String first = createService(token, "First");
		String second = createService(token, "Second");
		String third = createService(token, "Third");

		deactivate(token, second, "Second");

		mockMvc.perform(put("/api/v1/me/business/services/order").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"serviceIds":["%s","%s"]}""".formatted(third, first)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3));

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].name").value("Third"))
				.andExpect(jsonPath("$[0].sortOrder").value(10))
				.andExpect(jsonPath("$[1].name").value("First"))
				.andExpect(jsonPath("$[1].sortOrder").value(20))
				.andExpect(jsonPath("$[2].name").value("Second"))
				.andExpect(jsonPath("$[2].sortOrder").value(30));
	}

	/** Deactivating is a replacement carrying {@code active: false}, not an endpoint of its own. */
	private void deactivate(RequestPostProcessor token, String serviceId, String name) throws Exception {
		mockMvc.perform(put("/api/v1/me/business/services/" + serviceId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":0,"name":"%s","estimatedDurationMinutes":60,
								 "pricingMode":"QUOTE_ONLY","active":false}""".formatted(name)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.active").value(false));
	}

	/** Registers, creates a business, and returns the token that owns it. */
	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}

	private String createService(RequestPostProcessor token, String name) throws Exception {
		String body = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson(name, null, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		return JsonPath.read(body, "$.id");
	}

	/** Reads an id out of the live catalogue rather than hard-coding one from the migration. */
	private String tradeId(String code) throws Exception {
		String body = mockMvc.perform(get("/api/v1/trades"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		List<String> ids = JsonPath.read(body, "$[?(@.code=='" + code + "')].id");
		if (ids.isEmpty()) {
			throw new IllegalStateException("No trade " + code + " in the catalogue");
		}

		return ids.getFirst();
	}

	private static String tradesJson(String primary, String... additional) {
		String others = String.join("\",\"", additional);
		return """
				{"primaryTradeId":"%s","additionalTradeIds":[%s]}"""
				.formatted(primary, additional.length == 0 ? "" : "\"" + others + "\"");
	}

	private static String serviceJson(String name, String tradeId, String pricingMode, String price) {
		return """
				{
				  "name": "%s",
				  %s
				  "estimatedDurationMinutes": 60,
				  "pricingMode": "%s"%s
				}""".formatted(
				name,
				tradeId == null ? "" : "\"tradeId\": \"" + tradeId + "\",",
				pricingMode,
				price == null ? "" : ",\n  \"price\": \"" + price + "\"");
	}
}
