package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

	/** Present or absent by slug, so a shared database cannot make this flaky. */
	private static org.springframework.test.web.servlet.ResultMatcher slug(String slug, boolean expected) {
		return jsonPath("$.results[?(@.slug=='" + slug + "')]",
				expected ? Matchers.hasSize(1) : Matchers.empty());
	}

	private void publish(String subject, String slug, String postalCode, String tradeCode) throws Exception {
		RequestPostProcessor token =
				BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug, tradeCode);

		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, slug, postalCode))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());
	}
}
