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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The search box one keystroke at a time, end to end and without a token.
 *
 * <p>These type what a customer types — parts of words — rather than the labels the catalogue
 * stores. Matching a label back to itself would prove only that the row is there; what is worth
 * asserting is that four letters of a word nobody has finished typing reach the right job.
 *
 * <p>Every assertion filters by {@code code} rather than reading a position, except the one that
 * is about position. The catalogue is fixed reference data, but {@code offeredNearby} depends on
 * businesses other suites publish, and a test that read "the second row" would pass or fail on
 * the order the suite happened to run in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ServiceSuggestionTests {

	private static final String DENVER = "80202";

	/** About 63 miles from Denver, so well outside the fixture's 25-mile service radius. */
	private static final String COLORADO_SPRINGS = "80903";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/** The whole promise: an unfinished word, and the job it is the beginning of. */
	@Test
	void aPartialWordFindsTheJob() throws Exception {
		suggest("thermo").andExpect(status().isOk()).andExpect(offers("HVAC_THERMOSTAT_INSTALL"));
	}

	/**
	 * The report that prompted V20: a customer typed "Toilet is leaking" and was offered nothing.
	 *
	 * <p>The words were joined with AND, so every one of them had to match — and no catalogue
	 * entry contains a word beginning "is". Anybody typing a sentence rather than keywords hit it,
	 * which is most people, and an empty dropdown does not look like a fault to the person
	 * looking at it.
	 */
	@Test
	void aWholeSentenceFindsTheJobToo() throws Exception {
		suggest("Toilet is leaking").andExpect(offers("PLUMBER_TOILET_REPLACE"));
		suggest("my toilet is leaking").andExpect(offers("PLUMBER_TOILET_REPLACE"));
	}

	/**
	 * What stops OR from answering everything: a job has to account for half of what was typed,
	 * rounded up.
	 *
	 * <p>"is my the" carries three words and no entry begins two of them, so nothing comes back —
	 * without any of those words having been written down somewhere as one to ignore. A list would
	 * have had to be maintained, deployed, and would still have missed "urgently".
	 */
	@Test
	void fillerOnItsOwnIsNotAQuestion() throws Exception {
		suggest("is my the").andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
	}

	/**
	 * The other half of that floor: one typed word still needs only one match, so the list does
	 * not stay empty until somebody has typed two words.
	 */
	@Test
	void oneWordIsStillEnoughToAsk() throws Exception {
		suggest("toilet").andExpect(offers("PLUMBER_TOILET_REPLACE"));
	}

	/**
	 * Why V19 indexes with {@code simple} and not {@code english}, in one assertion.
	 *
	 * <p>The English configuration would store "lighting" as the lexeme "light". A customer six
	 * letters in has typed "lighti", which is a prefix of "lighting" and of nothing else — so the
	 * suggestion list would fill up at five characters and empty at six, which is the moment
	 * somebody decides the box is broken.
	 */
	@Test
	void prefixMatchingSurvivesWhereStemmingWouldNot() throws Exception {
		suggest("lighti").andExpect(offers("ELECTRICIAN_LIGHTING_INSTALL"));
	}

	/**
	 * "No hot water" is one of the most-typed openings there is, and under an English index the
	 * first word of it is a stop word — not searchable at all. Two characters in, the customer
	 * would be looking at an empty list.
	 */
	@Test
	void wordsAnEnglishIndexWouldThrowAwayAreStillSearchable() throws Exception {
		suggest("no hot").andExpect(offers("PLUMBER_WATER_HEATER_REPLACE"));
	}

	/**
	 * The synonyms carry both vocabularies on purpose. "Rooter" is what a plumber calls it and
	 * appears in no label; the customer reading the answer sees "Clear a blocked main sewer line".
	 */
	@Test
	void theWordsATradespersonUsesReachTheJobACustomerReads() throws Exception {
		suggest("rooter").andExpect(offers("PLUMBER_SEWER_MAIN_CLEAR"));
	}

	/**
	 * The weights in V19, and the one test here that reads a position because position is the
	 * claim. "Drain" is in one label and in several sets of synonyms — "move a drain", "drainage"
	 * — and the entry whose name carries it has to come first.
	 */
	@Test
	void aHitOnTheNameOutranksAHitOnTheSynonyms() throws Exception {
		suggest("drain")
				.andExpect(jsonPath("$[0].code").value("PLUMBER_DRAIN_UNCLOG"))
				.andExpect(jsonPath("$.length()", Matchers.greaterThan(1)));
	}

	/**
	 * Somebody mid-word has not made a mistake, and neither has somebody whose company name has
	 * an ampersand in it. The second is the one that would be a 500 rather than a 400: {@code
	 * to_tsquery} parses its argument as an expression language, and V19 exists so that typed
	 * text never reaches it unreduced.
	 */
	@Test
	void unfinishedTypingIsNotAMistake() throws Exception {
		suggest(" ").andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		suggest("&").andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		suggest("qwertzuiop").andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
	}

	/** A dropdown under a text field, not a results page. */
	@Test
	void noMoreThanADropdownHolds() throws Exception {
		suggest("r").andExpect(jsonPath("$.length()", Matchers.lessThanOrEqualTo(8)));
	}

	/**
	 * The three answers {@code offeredNearby} has, and the reason it has three.
	 *
	 * <p>Absent is not false. False is measured — somebody asked, and nobody near them does this
	 * work. Absent means no postal code was given, and a client that draws them the same way tells
	 * a customer they cannot be helped before they have said where they are.
	 *
	 * <p>The link is written here with SQL rather than through the API because there is no API for
	 * it yet: the tradesperson's side still stores a service under a free-typed name, and giving
	 * them the same catalogue to pick from is the next slice.
	 */
	@Test
	void availabilityIsAnsweredOnlyWhereSomewhereWasGiven() throws Exception {
		RequestPostProcessor token =
				BusinessFixtures.publishableBusinessFor(mockMvc, "user_suggest_supply", "suggest-supply");
		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, "suggest-supply", DENVER))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		jdbcTemplate.update("""
				UPDATE business_service
				SET catalog_id = (SELECT id FROM service_catalog WHERE code = 'PLUMBER_DRAIN_UNCLOG')
				WHERE business_id = (SELECT id FROM business_profile WHERE slug = 'suggest-supply')
				""");

		suggest("drain", DENVER).andExpect(nearby("PLUMBER_DRAIN_UNCLOG", true));
		suggest("drain", COLORADO_SPRINGS).andExpect(nearby("PLUMBER_DRAIN_UNCLOG", false));
		suggest("drain").andExpect(jsonPath(at("PLUMBER_DRAIN_UNCLOG") + ".offeredNearby")
				.value(Matchers.empty()));
	}

	/**
	 * The one field on this operation a customer can be wrong in. An unknown postal code answers
	 * 400 here exactly as it does on the search — blaming the letters for a mistake in the ZIP
	 * would send somebody to correct a search term that was right.
	 */
	@Test
	void aPostalCodeTheCensusDoesNotListIsStillWorthSayingSoAbout() throws Exception {
		suggest("drain", "00000").andExpect(status().isBadRequest());
	}

	private ResultActions suggest(String typed) throws Exception {
		return mockMvc.perform(get("/api/v1/service-catalog").param("q", typed));
	}

	private ResultActions suggest(String typed, String zip) throws Exception {
		return mockMvc.perform(get("/api/v1/service-catalog").param("q", typed).param("zip", zip));
	}

	private static ResultMatcher offers(String code) {
		return jsonPath(at(code) + ".code").value(Matchers.contains(code));
	}

	private static ResultMatcher nearby(String code, boolean expected) {
		return jsonPath(at(code) + ".offeredNearby").value(Matchers.contains(expected));
	}

	private static String at(String code) {
		return "$[?(@.code=='" + code + "')]";
	}
}
