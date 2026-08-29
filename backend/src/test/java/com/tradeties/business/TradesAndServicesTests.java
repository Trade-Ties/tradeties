package com.tradeties.business;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.jdbc.core.JdbcTemplate;
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

	@Autowired
	JdbcTemplate jdbc;

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
	 * The one that would break silently. A service is filed under a link in
	 * {@code business_trade}, so replacing the selection by retiring every link and reviving the
	 * survivors would take every service with it — including those under trades the tradesperson
	 * kept. {@code TradeSelectionService} therefore retires only the links that actually leave.
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

	/**
	 * There is no service that sits under no trade: a service belongs to exactly one, so an omitted
	 * {@code tradeId} is a missing required field rather than a claim that it spans trades.
	 */
	@Test
	void aServiceMustNameATrade() throws Exception {
		RequestPostProcessor token = businessFor("user_no_trade_service", "no-trade-service");
		claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Emergency call-out", null, "HOURLY", "195.00")))
				.andExpect(status().isBadRequest());
	}

	/**
	 * An hourly service may state a rate of its own, which overrides the business's general one.
	 *
	 * <p>The rule reads as an absence — {@code requireValidPricing} has an {@code HOURLY} branch
	 * that deliberately does nothing — so nothing complains the day it stops being true.
	 *
	 * <p>Worth having on its own: {@code PublishService.hourlyServicesHaveARate} lets a business
	 * with no general rate publish precisely because each of its hourly services can carry one.
	 */
	@Test
	void anHourlyServiceMayCarryItsOwnRate() throws Exception {
		RequestPostProcessor token = businessFor("user_hourly_rate", "hourly-rate");
		String plumber = claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Emergency call-out", plumber, "HOURLY", "195.00")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.pricingMode").value("HOURLY"))
				.andExpect(jsonPath("$.price").value(containsString("195")));
	}

	/**
	 * The guarantee the wizard's write order rests on.
	 *
	 * <p>The services screen invites somebody to move a service off a trade they are dropping —
	 * "Pick another trade, or this service goes with it" — and the client makes that work by
	 * widening the selection, moving the service, then narrowing again. It has to, because the
	 * removal keys off the trade the row is <em>stored</em> under, not the one being typed.
	 *
	 * <p>Pinned here because nothing in Java would fail if it stopped being true. The service
	 * would simply be retired along with the trade, and the client's {@code PUT} would answer 404
	 * on a screen offering no way past it.
	 */
	@Test
	void aServiceMovedOffATradeBeforeItIsDroppedSurvivesTheDrop() throws Exception {
		RequestPostProcessor token = businessFor("user_refiles_service", "refiles-service");
		String plumber = tradeId("PLUMBER");
		String roofer = tradeId("ROOFER");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber, roofer)))
				.andExpect(status().isOk());

		String created = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Gutter repair", roofer, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		String serviceId = JsonPath.read(created, "$.id");
		int version = JsonPath.read(created, "$.version");

		// Moved while both trades are still held, which is the whole point of the order.
		mockMvc.perform(put("/api/v1/me/business/services/" + serviceId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":%d,"tradeId":"%s","name":"Gutter repair",
								 "estimatedDurationMinutes":60,"pricingMode":"QUOTE_ONLY"}"""
								.formatted(version, plumber)))
				.andExpect(status().isOk());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber)))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].id").value(serviceId))
				.andExpect(jsonPath("$[0].tradeId").value(plumber))
				.andExpect(jsonPath("$[0].active").value(true));
	}

	/**
	 * The half a tradesperson feels: a trade that leaves takes the services filed under it out
	 * of the catalogue, while the trades that stay keep theirs.
	 */
	@Test
	void droppingATradeTakesItsServicesOutOfTheCatalogue() throws Exception {
		RequestPostProcessor token = businessFor("user_drops_trade", "drops-trade");
		String plumber = tradeId("PLUMBER");
		String roofer = tradeId("ROOFER");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber, roofer)))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Clog removal", plumber, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Gutter repair", roofer, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber)))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].name").value("Clog removal"))
				.andExpect(jsonPath("$[0].tradeId").value(plumber));

		mockMvc.perform(get("/api/v1/me/business/trades").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.additional.length()").value(0));
	}

	/**
	 * The point of the whole soft-delete change, and the one thing no API call can show: what
	 * left the catalogue is still in the table. Asked of PostgreSQL directly, because every read
	 * path above is filtered and would answer "gone" either way.
	 */
	@Test
	void aDroppedTradeAndItsServicesSurviveInTheTable() throws Exception {
		RequestPostProcessor token = businessFor("user_soft_delete", "soft-delete");
		String plumber = tradeId("PLUMBER");
		String roofer = tradeId("ROOFER");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber, roofer)))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Gutter repair", roofer, "FLAT", "480.00")))
				.andExpect(status().isCreated());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber)))
				.andExpect(status().isOk());

		UUID business = businessIdOf("soft-delete");

		assertEquals(1, jdbc.queryForObject("""
				SELECT count(*) FROM business_service
				WHERE business_id = ? AND name = 'Gutter repair' AND deleted_at IS NOT NULL""",
				Integer.class, business),
				"the service row was destroyed rather than stamped");

		assertEquals(1, jdbc.queryForObject("""
				SELECT count(*) FROM business_trade
				WHERE business_id = ? AND trade_id = ?::uuid AND deleted_at IS NOT NULL""",
				Integer.class, business, roofer),
				"the trade link was destroyed rather than stamped");
	}

	/**
	 * The collision the primary key would otherwise produce. A trade that comes back is the row
	 * that is already there — inserting a second {@code (business_id, trade_id)} is not
	 * available, and a filter that hid the retired one would leave nothing else to do.
	 *
	 * <p>Its services stay gone. They were removed; taking the trade back says nothing about
	 * them, and quietly reviving a price list somebody retired is not a favour.
	 */
	@Test
	void aTradeCanBeTakenBackAfterItWasGivenUp() throws Exception {
		RequestPostProcessor token = businessFor("user_retakes_trade", "retakes-trade");
		String plumber = tradeId("PLUMBER");
		String roofer = tradeId("ROOFER");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber, roofer)))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Gutter repair", roofer, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber)))
				.andExpect(status().isOk());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(plumber, roofer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.additional.length()").value(1));

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	/**
	 * The same collision on the other index. A trade given up as primary keeps {@code is_primary}
	 * nowhere: {@code retire} clears it, and the partial unique index counts only live rows —
	 * either alone would do, and together they are what makes the next primary insertable.
	 */
	@Test
	void thePrimaryTradeCanBeReplacedByOneTheBusinessDidNotHold() throws Exception {
		RequestPostProcessor token = businessFor("user_swaps_primary", "swaps-primary");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(tradeId("PLUMBER"))))
				.andExpect(status().isOk());

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(tradesJson(tradeId("ROOFER"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.primary.code").value("ROOFER"))
				.andExpect(jsonPath("$.additional.length()").value(0));
	}

	/**
	 * Removing "Clog removal" and adding it back is the most ordinary thing on that screen. The
	 * unique index is partial for exactly this: uniqueness is a rule about the services a
	 * business has, and a retired row holding a name hostage is a 409 about something the
	 * tradesperson can no longer see.
	 */
	@Test
	void aRemovedServiceGivesItsNameBack() throws Exception {
		RequestPostProcessor token = businessFor("user_reuses_name", "reuses-name");
		String serviceId = createService(token, "Clog removal");

		mockMvc.perform(delete("/api/v1/me/business/services/" + serviceId).with(token))
				.andExpect(status().isNoContent());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Clog removal", tradeId("PLUMBER"), "QUOTE_ONLY", null)))
				.andExpect(status().isCreated());
	}

	/**
	 * The rule lives only in a database CHECK — the contract cannot express "required for
	 * these modes, forbidden for that one". Without the service-level check this arrives as
	 * a constraint violation and gets blamed on the service name.
	 */
	@Test
	void quoteOnlyMustNotCarryAPrice() throws Exception {
		RequestPostProcessor token = businessFor("user_quote_price", "quote-price");
		String plumber = claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Leak diagnosis", plumber, "QUOTE_ONLY", "150.00")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void aFlatPriceIsMandatory() throws Exception {
		RequestPostProcessor token = businessFor("user_flat_no_price", "flat-no-price");
		String plumber = claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Water heater swap", plumber, "FLAT", null)))
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
		String plumber = claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Whole-house repipe", plumber, "FLAT", "28000.00")))
				.andExpect(status().isCreated());
	}

	@Test
	void aGrosslySlippedFlatPriceIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_slipped_job", "slipped-job");
		String plumber = claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Whole-house repipe", plumber, "FLAT", "2800000.00")))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The same width at a service price, and here it is worse than a 500. The insert reaches the
	 * database, and without this the catch that translates a lost name race answers "a service
	 * called 'Huge' already exists" — about a name that was free, on a write that failed for a
	 * reason nobody was told.
	 */
	@Test
	void anAmountWiderThanTheColumnIsNotReportedAsADuplicateName() throws Exception {
		RequestPostProcessor token = businessFor("user_wide_price", "wide-price");
		String plumber = claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Huge", plumber, "FLAT", "99999999999999999999")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void twoServicesCannotShareANameEvenInDifferentCase() throws Exception {
		RequestPostProcessor token = businessFor("user_dup_service", "dup-service");
		String plumber = claimPrimaryTrade(token);

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("Clog removal", plumber, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(serviceJson("CLOG REMOVAL", plumber, "QUOTE_ONLY", null)))
				.andExpect(status().isConflict());
	}

	@Test
	void replacingWithAStaleVersionIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_stale_service", "stale-service");
		String serviceId = createService(token, "Drain snake");

		mockMvc.perform(put("/api/v1/me/business/services/" + serviceId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":99,"tradeId":"%s","name":"Renamed","estimatedDurationMinutes":60,
								 "pricingMode":"QUOTE_ONLY"}""".formatted(tradeId("PLUMBER"))))
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
	 * The case a count cannot describe: the right number of ids, one of them wrong. "Expected 2,
	 * got 2" is perfectly true and no help in finding which.
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
								{"version":0,"tradeId":"%s","name":"%s","estimatedDurationMinutes":60,
								 "pricingMode":"QUOTE_ONLY","active":false}""".formatted(tradeId("PLUMBER"), name)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.active").value(false));
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}

	/**
	 * For the tests below that are about a service's id, its position or its removal rather than
	 * about which trade it sits under.
	 */
	private String createService(RequestPostProcessor token, String name) throws Exception {
		return BusinessFixtures.givenAService(mockMvc, token, name);
	}

	private UUID businessIdOf(String slug) {
		return jdbc.queryForObject("SELECT id FROM business_profile WHERE slug = ?", UUID.class, slug);
	}

	private String claimPrimaryTrade(RequestPostProcessor token) throws Exception {
		return BusinessFixtures.claimPrimaryTrade(mockMvc, token, "PLUMBER");
	}

	private String tradeId(String code) throws Exception {
		return BusinessFixtures.tradeId(mockMvc, code);
	}

	private static String tradesJson(String primary, String... additional) {
		String others = String.join("\",\"", additional);
		return """
				{"primaryTradeId":"%s","additionalTradeIds":[%s]}"""
				.formatted(primary, additional.length == 0 ? "" : "\"" + others + "\"");
	}

	private static String serviceJson(String name, String tradeId, String pricingMode, String price) {
		return BusinessFixtures.serviceJson("", name, tradeId, pricingMode, price);
	}
}
