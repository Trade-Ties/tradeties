package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The customer's search, end to end and without a token.
 *
 * <p>Three postal codes carry every case here: Denver 80202, Boulder 80301 about 24 miles away,
 * and Colorado Springs 80903 about 63. Against the fixture's 25-mile radius that puts Boulder just
 * inside and Colorado Springs well outside, with room on either side that no answer turns on the
 * polygon's approximation of a circle.
 *
 * <p>Every assertion filters by slug rather than reading a position in the list. The suite shares
 * one database and other classes publish businesses of their own; a test that asserted "the first
 * result" would pass or fail on the order the suite happened to run in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BusinessSearchTests {

	private static final String DENVER = "80202";
	private static final String BOULDER = "80301";
	private static final String COLORADO_SPRINGS = "80903";

	/** The zone every fixture business keeps its hours in, and the one its slots read back in. */
	private static final ZoneId MOUNTAIN = ZoneId.of("America/Denver");

	private static final String RENAME = """
			UPDATE business_profile SET display_name = ? WHERE slug = ?""";

	private static final String DELETE_WORKING_HOURS = """
			DELETE FROM availability_working_hours
			WHERE business_id = (SELECT id FROM business_profile WHERE slug = ?)""";

	private static final String INSERT_LICENCE = """
			INSERT INTO business_license (id, business_id, state, license_number, expires_on,
				created_at, updated_at, version)
			VALUES (?, (SELECT id FROM business_profile WHERE slug = ?), 'CO', ?, ?, now(), now(), 0)""";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/** The rule the whole customer side rests on: no account, no token, no sign-in. */
	@Test
	void theSearchAnswersWithoutAToken() throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results").isArray());
	}

	/**
	 * The radius belongs to the business. Both fixtures declare 25 miles and sit 24 miles apart,
	 * so each reaches the other — and neither reaches Colorado Springs.
	 */
	@Test
	void aBusinessIsFoundWhereItsOwnAreaReaches() throws Exception {
		publish("user_find_near", "find-near", DENVER, "PLUMBER");

		mockMvc.perform(get("/api/v1/businesses").param("zip", BOULDER))
				.andExpect(status().isOk())
				.andExpect(slug("find-near", true));

		mockMvc.perform(get("/api/v1/businesses").param("zip", COLORADO_SPRINGS))
				.andExpect(slug("find-near", false));
	}

	/** A draft is nobody's to find, however close it is. */
	@Test
	void anUnpublishedProfileIsNotOffered() throws Exception {
		BusinessFixtures.publishableBusinessFor(mockMvc, "user_find_draft", "find-draft");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER))
				.andExpect(slug("find-draft", false));
	}

	/**
	 * The description narrows, and the customer never picked a trade to make it. A roofer in the
	 * same town is the control: it is found without a description and gone with one that means
	 * plumbing.
	 */
	@Test
	void aDescriptionNarrowsToTheTradeItMeans() throws Exception {
		publish("user_find_plumb", "find-plumb", DENVER, "PLUMBER");
		publish("user_find_roof", "find-roof", DENVER, "ROOFER");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER))
				.andExpect(slug("find-plumb", true))
				.andExpect(slug("find-roof", true));

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("job", "no hot water"))
				.andExpect(slug("find-plumb", true))
				.andExpect(slug("find-roof", false))
				.andExpect(jsonPath("$.matchedTrades[0].code").value("PLUMBER"));
	}

	/**
	 * What the description was read as, in the answer. Without it a client can only guess whether
	 * a short result list means "few tradespeople" or "we read your sentence differently than you
	 * meant it" — and only the customer can settle that.
	 */
	@Test
	void theAnswerSaysWhatItUnderstood() throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("job", "the breaker keeps tripping"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.matchedTrades[0].code").value("ELECTRICIAN"));

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("job", "qwertzuiop"))
				.andExpect(jsonPath("$.matchedTrades").isEmpty());
	}

	/**
	 * A description naming no trade must not narrow to nothing. "Not understood" and "nobody
	 * offers that" are different answers, and only one of them should empty the page.
	 */
	@Test
	void anUnreadableDescriptionDoesNotHideEverybody() throws Exception {
		publish("user_find_gibberish", "find-gibberish", DENVER, "PLUMBER");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("job", "qwertzuiop"))
				.andExpect(slug("find-gibberish", true));
	}

	/**
	 * A postal code the Census does not list is refused, not answered with nothing. The whole
	 * reason: somebody who mistypes 80202 as 80292 and is told "no tradespeople near you" learns
	 * the wrong lesson and may go correct an address that was right.
	 *
	 * <p>The {@code type} is asserted because a client branches on it. Without one this refusal
	 * and the two below are the same status and nothing else, and the search page would explain a
	 * request it malformed itself as a postal code nobody has heard of.
	 */
	@Test
	void aPostalCodeNobodyKnowsIsRefused() throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", "00000"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").value("urn:tradeties:problem:invalid-selection"))
				.andExpect(jsonPath("$.detail").value(Matchers.containsString("00000")));
	}

	/**
	 * The contract's own pattern, refused before anything runs — and untyped, deliberately.
	 *
	 * <p>Absent rather than the string {@code about:blank}: Spring omits the field for the
	 * default type, and a client that reads no type reads it as untyped either way. Asserting
	 * the string would pass against a serialiser that wrote it out and say nothing about this one.
	 */
	@Test
	void aPostalCodeOfTheWrongShapeIsRefused() throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").doesNotExist());
	}

	/**
	 * The refusal that made the type necessary. A description past the contract's length is a 400
	 * like an unknown postal code, and nothing but the type separates them — read as the latter,
	 * it sends somebody to correct an address that was right.
	 */
	@Test
	void aDescriptionPastTheContractsLengthIsRefusedUntyped() throws Exception {
		mockMvc.perform(get("/api/v1/businesses")
						.param("zip", DENVER)
						.param("job", "x".repeat(301)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").doesNotExist());
	}

	/** Nearest first, which is the only ordering promised. */
	@Test
	void resultsComeBackNearestFirst() throws Exception {
		publish("user_find_here", "find-here", BOULDER, "PLUMBER");
		publish("user_find_away", "find-away", DENVER, "PLUMBER");

		mockMvc.perform(get("/api/v1/businesses").param("zip", BOULDER))
				.andExpect(status().isOk())
				.andExpect(jsonPath(
						"$.results[?(@.slug=='find-here')].distanceMiles",
						Matchers.everyItem(Matchers.lessThan(1.0))))
				.andExpect(jsonPath(
						"$.results[?(@.slug=='find-away')].distanceMiles",
						Matchers.everyItem(Matchers.greaterThan(20.0))));
	}

	/**
	 * A published profile whose postal code stopped resolving has no area and cannot be reached.
	 * It is the state {@code ADDRESS_GEOCODED} exists to prevent, said again by the storage: the
	 * index has nothing to find, without a clause anywhere saying so.
	 */
	@Test
	void aPublishedProfileWithoutAPointIsUnreachable() throws Exception {
		publish("user_find_nopoint", "find-nopoint", DENVER, "PLUMBER");
		jdbcTemplate.update("""
				UPDATE business_profile
				SET latitude = NULL, longitude = NULL, geocode_precision = NULL
				WHERE slug = 'find-nopoint'""");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER))
				.andExpect(slug("find-nopoint", false));
	}

	/**
	 * The rate comes off the profile's own pricing, as a string at the scale the column stores —
	 * the same shape the tradesperson's side of the API sends it back in.
	 */
	@Test
	void aResultCarriesTheRateTheBusinessCharges() throws Exception {
		RequestPostProcessor token = publish("user_find_rate", "find-rate", DENVER, "PLUMBER");
		BusinessFixtures.setPricing(mockMvc, token, "85.00");

		assertEquals("85.0000", result(DENVER, "find-rate").get("hourlyRate"));
	}

	/**
	 * Pricing is an onboarding step a published profile need not have reached. Absent is common,
	 * it is not a fault, and above all it does not make the business unfindable.
	 */
	@Test
	void aBusinessThatHasNotPricedItselfIsStillFound() throws Exception {
		publish("user_find_norate", "find-norate", DENVER, "PLUMBER");

		assertNull(result(DENVER, "find-norate").get("hourlyRate"));
	}

	/**
	 * Two flags and not one. A licence on file is a different claim from a licence somebody has
	 * checked, and collapsing them would put the issuing state's word behind a number that was
	 * merely typed in.
	 */
	@Test
	void aLicenceCountsOnceOnFileAndIsVerifiedOnlyOnceChecked() throws Exception {
		publish("user_find_lic", "find-lic", DENVER, "PLUMBER");
		givenALicence("find-lic", "CO-FIND-1", LocalDate.now().plusYears(1));

		Map<String, Object> onFile = result(DENVER, "find-lic");
		assertEquals(true, onFile.get("licensed"));
		assertEquals(false, onFile.get("licenseVerified"));

		jdbcTemplate.update("UPDATE business_license SET verified_at = now() WHERE license_number = ?",
				"CO-FIND-1");

		assertEquals(true, result(DENVER, "find-lic").get("licenseVerified"));
	}

	/** A badge is a statement about today, so a licence that has run out makes neither of them. */
	@Test
	void anExpiredLicenceCountsForNothing() throws Exception {
		publish("user_find_exp", "find-exp", DENVER, "PLUMBER");
		givenALicence("find-exp", "CO-FIND-2", LocalDate.now().minusDays(1));
		jdbcTemplate.update("UPDATE business_license SET verified_at = now() WHERE license_number = ?",
				"CO-FIND-2");

		Map<String, Object> expired = result(DENVER, "find-exp");
		assertEquals(false, expired.get("licensed"));
		assertEquals(false, expired.get("licenseVerified"));
	}

	/**
	 * The fixture works Mondays, nine to five, and its rules ask for a day of notice — so what
	 * comes back is Monday mornings, never today, and always in order.
	 *
	 * <p>Asserted as properties rather than as three timestamps. The suite runs on whichever day
	 * it runs on, and a list of literal instants would be a test that only passes on Tuesdays.
	 */
	@Test
	void theSlotsOfferedFollowTheWorkingWeek() throws Exception {
		publish("user_find_slots", "find-slots", DENVER, "PLUMBER");

		Map<String, Object> found = result(DENVER, "find-slots");

		// The zone travels with the slots. Without it the client has an instant and no clock to
		// read it on, and would fall back to the reader's — an hour the tradesperson never offered.
		assertEquals(MOUNTAIN.getId(), found.get("timeZone"));

		List<String> slots = slotsOf(found);
		assertEquals(3, slots.size(), "the search offers three start times per result");

		Instant previous = null;
		for (String slot : slots) {
			ZonedDateTime local = OffsetDateTime.parse(slot).atZoneSameInstant(MOUNTAIN);

			assertEquals(DayOfWeek.MONDAY, local.getDayOfWeek(), slot + " is not a Monday");
			assertTrue(!local.toLocalTime().isBefore(LocalTime.of(9, 0))
							&& !local.toLocalTime().isAfter(LocalTime.of(16, 30)),
					slot + " falls outside the nine-to-five the fixture works");
			assertTrue(local.toInstant().isAfter(Instant.now().plus(Duration.ofHours(23))),
					slot + " is inside the day of notice the booking rules require");

			if (previous != null) {
				assertTrue(local.toInstant().isAfter(previous), "slots came back out of order");
			}
			previous = local.toInstant();
		}
	}

	/**
	 * No working hours at all is onboarding step 7 not reached, which is a different statement
	 * from "closed all week". Both mean there is nothing to offer, and both answer with an empty
	 * list — never a missing field the client has to defend itself against.
	 */
	@Test
	void aBusinessWithoutAWorkingWeekOffersNoSlots() throws Exception {
		publish("user_find_noslots", "find-noslots", DENVER, "PLUMBER");
		jdbcTemplate.update(DELETE_WORKING_HOURS, "find-noslots");

		assertEquals(List.of(), slotsOf(result(DENVER, "find-noslots")));
	}

	/**
	 * One search result, read as a map.
	 *
	 * <p>Filtered in JSONPath but asserted in Java, rather than the other way round: a null field
	 * is dropped by a JSONPath filter expression, so "the rate is absent" and "the business is
	 * absent" would otherwise be the same green.
	 */
	private Map<String, Object> result(String zip, String slug) throws Exception {
		String body = mockMvc.perform(get("/api/v1/businesses").param("zip", zip))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		List<Map<String, Object>> found = JsonPath.read(body, "$.results[?(@.slug=='" + slug + "')]");
		assertEquals(1, found.size(), slug + " should appear exactly once");

		return found.get(0);
	}

	@SuppressWarnings("unchecked")
	private static List<String> slotsOf(Map<String, Object> result) {
		return (List<String>) result.get("nextSlots");
	}

	/**
	 * Inserted rather than posted. The endpoint cannot express either half of what these tests
	 * need — an expiry already in the past, or a verification only the issuing state performs.
	 */
	private void givenALicence(String slug, String number, LocalDate expiresOn) {
		jdbcTemplate.update(INSERT_LICENCE, UUID.randomUUID(), slug, number,
				java.sql.Date.valueOf(expiresOn));
	}

	/**
	 * The name narrows, and it narrows to the business that bears it.
	 *
	 * <p>Two assertions and not one. That the named business comes back proves the match; that a
	 * business standing at the same address does not proves the parameter filtered rather than
	 * being accepted and ignored — which is exactly how this looked before it was implemented.
	 */
	@Test
	void aNameFindsTheBusinessThatBearsIt() throws Exception {
		publish("user_find_name", "find-name", DENVER, "PLUMBER");
		renameTo("find-name", "Okonkwo Heating & Air");
		publish("user_find_name_other", "find-name-other", DENVER, "PLUMBER");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "Okonkwo"))
				.andExpect(status().isOk())
				.andExpect(slug("find-name", true))
				.andExpect(slug("find-name-other", false));
	}

	/**
	 * The promise the trigram index was created for, in the words its migration used: a name
	 * spelled wrong still finds the business.
	 *
	 * <p>"Joes Plumbin" against "Joe's Plumbing" scores 0.625 on word similarity, against a
	 * threshold of 0.6 — measured, not assumed. It is close to the line on purpose: a test that
	 * only searched for names spelled correctly would pass against plain equality and would prove
	 * nothing about the letter groups.
	 */
	@Test
	void aMisspelledNameStillFindsIt() throws Exception {
		publish("user_find_typo", "find-typo", DENVER, "PLUMBER");
		renameTo("find-typo", "Joe's Plumbing");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "Joes Plumbin"))
				.andExpect(status().isOk())
				.andExpect(slug("find-typo", true));
	}

	/** Near enough is not the same as anything goes: an unrelated name matches nobody. */
	@Test
	void aNameNothingBearsFindsNobody() throws Exception {
		publish("user_find_miss", "find-miss", DENVER, "PLUMBER");
		renameTo("find-miss", "Okonkwo Heating & Air");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER))
				.andExpect(slug("find-miss", true));

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "Electric"))
				.andExpect(status().isOk())
				.andExpect(slug("find-miss", false));
	}

	/** Blank is absent. A search box the customer never typed in must not narrow anything. */
	@Test
	void aBlankNameNarrowsNothing() throws Exception {
		publish("user_find_blank", "find-blank", DENVER, "PLUMBER");
		renameTo("find-blank", "Okonkwo Heating & Air");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "   "))
				.andExpect(status().isOk())
				.andExpect(slug("find-blank", true));
	}

	/**
	 * Name and description are an AND, and this is the case that tells an AND from an OR.
	 *
	 * <p>The business is a plumber called "Okonkwo Heating & Air". Its name matches; the
	 * description reads as an electrician and its trade does not. An OR would return it on the
	 * strength of the name alone.
	 */
	@Test
	void aNameAndADescriptionMustBothHold() throws Exception {
		publish("user_find_both", "find-both", DENVER, "PLUMBER");
		renameTo("find-both", "Okonkwo Heating & Air");

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "Okonkwo"))
				.andExpect(slug("find-both", true));

		mockMvc.perform(get("/api/v1/businesses")
						.param("zip", DENVER)
						.param("name", "Okonkwo")
						.param("job", "the breaker keeps tripping"))
				.andExpect(status().isOk())
				.andExpect(slug("find-both", false));
	}

	/**
	 * The radius still holds. A business that does not travel to the customer is not made
	 * relevant by being named correctly, which is the whole reason this parameter lives on this
	 * operation rather than on a lookup of its own.
	 */
	@Test
	void aNameDoesNotReachPastTheServiceArea() throws Exception {
		publish("user_find_far", "find-far", DENVER, "PLUMBER");
		renameTo("find-far", "Okonkwo Heating & Air");

		mockMvc.perform(get("/api/v1/businesses").param("zip", COLORADO_SPRINGS).param("name", "Okonkwo"))
				.andExpect(status().isOk())
				.andExpect(slug("find-far", false));
	}

	/**
	 * Renamed in the database rather than through the API, because every fixture business is
	 * called "Acme Plumbing" and a name search over identical names proves nothing. Nothing else
	 * in the profile is touched.
	 */
	private void renameTo(String slug, String displayName) {
		jdbcTemplate.update(RENAME, displayName, slug);
	}

	/** Present or absent by slug, so a shared database cannot make this flaky. */
	private static org.springframework.test.web.servlet.ResultMatcher slug(String slug, boolean expected) {
		return jsonPath("$.results[?(@.slug=='" + slug + "')]",
				expected ? Matchers.hasSize(1) : Matchers.empty());
	}

	/** @return the owner's token, for the tests that go on to price the business */
	private RequestPostProcessor publish(String subject, String slug, String postalCode, String tradeCode)
			throws Exception {

		RequestPostProcessor token =
				BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug, tradeCode);

		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, slug, postalCode))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		return token;
	}
}
