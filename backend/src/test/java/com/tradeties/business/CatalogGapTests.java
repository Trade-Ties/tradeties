package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * What the catalogue could not name, written down where somebody will see it.
 *
 * <p>The 72 entries it holds were derived from a development seed by somebody who had watched no
 * customers — and it shows, because "Toilet is leaking" has no entry and that was found by
 * accident. These assertions are about the accident stopping.
 *
 * <p>Every phrase here is deliberately one no other test uses. The suite shares a database and
 * this table counts sightings, so a phrase two classes both trip over would make either of them
 * depend on the order they ran in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CatalogGapTests {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/**
	 * A tradesperson naming work the catalogue has no entry for. Not an error — the catalogue does
	 * not know every job — but it is the only way anybody learns that this one exists.
	 */
	@Test
	void aServiceTypedByHandIsNotedAsAGap() throws Exception {
		RequestPostProcessor token = plumberFor("user_gap_pro", "gap-pro");

		addService(token, "Reglaze a chipped enamel bathtub");

		assertEquals(1, sightingsOf("PRO", "Reglaze a chipped enamel bathtub"));
	}

	/** A ticked job is already named, so there is nothing to learn from it. */
	@Test
	void aServiceFromTheCatalogueIsNotAGap() throws Exception {
		RequestPostProcessor token = plumberFor("user_gap_ticked", "gap-ticked");
		String jobs = mockMvc.perform(get("/api/v1/service-jobs"))
				.andReturn().getResponse().getContentAsString();
		String filter = "$[?(@.code=='PLUMBER_SUMP_PUMP_INSTALL')].";

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.serviceJson(
								"\"catalogId\": \"" + one(jobs, filter + "id") + "\",",
								one(jobs, filter + "label"), one(jobs, filter + "tradeId"),
								"QUOTE_ONLY", null)))
				.andExpect(status().isCreated());

		assertEquals(0, sightingsOf("PRO", "Install a sump pump"));
	}

	/**
	 * The customer half, and the case that prompted the whole table.
	 *
	 * <p>The search still answers this — it reads plumbing out of the words and returns plumbers —
	 * so nothing about the result says the catalogue has no name for it. This row is the only
	 * place that shows.
	 */
	@Test
	void aDescriptionTheCatalogueCannotNameIsNotedAsAGap() throws Exception {
		search("my pergola has woodworm");

		assertEquals(1, sightingsOf("CUSTOMER", "my pergola has woodworm"));
	}

	/**
	 * The count is the point: one typo stays at one and sinks, while the same missing job asked
	 * eighteen times rises to the top of the list without anybody sorting it by hand.
	 */
	@Test
	void theSamePhraseIsCountedRatherThanRepeated() throws Exception {
		search("my koi pond pump is rattling");
		search("My Koi Pond Pump Is Rattling");
		search("  my koi   pond pump is rattling  ");

		assertEquals(3, sightingsOf("CUSTOMER", "my koi pond pump is rattling"));
		assertEquals(1, rowsFor("CUSTOMER", "my koi pond pump is rattling"));
	}

	/** A description the catalogue can name is not a gap, whatever the search then answers. */
	@Test
	void aDescriptionTheCatalogueCanNameIsNotAGap() throws Exception {
		search("toilet leaking");

		assertEquals(0, sightingsOf("CUSTOMER", "toilet leaking"));
	}

	/**
	 * A customer who chose from the list was answered by the catalogue, whatever they typed on the
	 * way there — and what they typed on the way is usually the label itself.
	 */
	@Test
	void pickingAJobRecordsNoGapAtAll() throws Exception {
		mockMvc.perform(get("/api/v1/businesses")
						.param("zip", "80202")
						.param("job", "my dumbwaiter is stuck between floors")
						.param("service", "PLUMBER_TOILET_REPLACE"))
				.andExpect(status().isOk());

		assertEquals(0, sightingsOf("CUSTOMER", "my dumbwaiter is stuck between floors"));
	}

	private void search(String description) throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", "80202").param("job", description))
				.andExpect(status().isOk());
	}

	private void addService(RequestPostProcessor token, String name) throws Exception {
		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.serviceJson("", name,
								BusinessFixtures.tradeId(mockMvc, "PLUMBER"), "QUOTE_ONLY", null)))
				.andExpect(status().isCreated());
	}

	private int sightingsOf(String source, String phrase) {
		Integer seen = jdbcTemplate.queryForObject("""
				SELECT coalesce(sum(seen_count), 0) FROM service_catalog_suggestion
				WHERE source = ? AND lower(phrase) = lower(?)
				""", Integer.class, source, phrase);

		return seen == null ? 0 : seen;
	}

	private int rowsFor(String source, String phrase) {
		Integer rows = jdbcTemplate.queryForObject("""
				SELECT count(*) FROM service_catalog_suggestion
				WHERE source = ? AND lower(phrase) = lower(?)
				""", Integer.class, source, phrase);

		return rows == null ? 0 : rows;
	}

	private static String one(String body, String path) {
		java.util.List<String> matched = com.jayway.jsonpath.JsonPath.read(body, path);
		return matched.getFirst();
	}

	private RequestPostProcessor plumberFor(String subject, String slug) throws Exception {
		RequestPostProcessor token = BusinessFixtures.businessFor(mockMvc, subject, slug);
		BusinessFixtures.claimPrimaryTrade(mockMvc, token, "PLUMBER");
		return token;
	}
}
