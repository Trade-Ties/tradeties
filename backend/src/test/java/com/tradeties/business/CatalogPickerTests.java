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

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Step 4 as a picker rather than a form.
 *
 * <p>The measurement behind it: the seeded marketplace averages 3.1 services per business, for
 * businesses that do thirty kinds of work. Naming, timing and pricing each one by hand is why. A
 * search that narrows by job can only be as good as those lists, so ticking has to be the cheap
 * path — and the link a tick leaves behind is what the search follows.
 *
 * <p>What the server owns is narrow on purpose: the list of jobs, and the rule that a service's
 * link and its trade agree. Which jobs a given business is shown, and which of them it has
 * already ticked, are the client's — they answer to a trade chosen on the screen before, and to
 * ticks not yet saved.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CatalogPickerTests {

	@Autowired
	MockMvc mockMvc;

	/**
	 * Reference data, like the trades beside it: no token, the same answer for everybody, and
	 * every job carrying the trade it is filed under so a caller can narrow to one business's.
	 */
	@Test
	void theJobsAreReferenceDataAndCarryTheirTrade() throws Exception {
		mockMvc.perform(get("/api/v1/service-jobs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.code=='PLUMBER_TOILET_REPLACE')].label")
						.value(Matchers.contains("Replace a toilet")))
				.andExpect(jsonPath("$[*].tradeId").value(Matchers.everyItem(Matchers.notNullValue())))
				.andExpect(jsonPath("$[*].tradeId")
						.value(Matchers.hasSize(Matchers.greaterThan(1))));
	}

	/**
	 * The picker's whole output: a service carrying the link. Everything else — the name, the
	 * time, the price mode — the client fills from the job it ticked and the holder edits
	 * afterwards, which is why none of it is decided here.
	 */
	@Test
	void aTickedJobBecomesAServiceThatRemembersIt() throws Exception {
		RequestPostProcessor token = plumberFor("user_picker_link", "picker-link");
		Job toilet = job("PLUMBER_TOILET_REPLACE");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON).content(ticked(toilet)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("Replace a toilet"))
				.andExpect(jsonPath("$.catalogId").value(toilet.id()));
	}

	/**
	 * A link and a trade are one statement about one service, so they have to agree.
	 *
	 * <p>The database cannot see this: {@code catalog_id} is a plain foreign key onto the
	 * catalogue and knows nothing about the trade the row is filed under. A disagreement would
	 * save cleanly, look right on the profile, and surface as results nobody could explain.
	 */
	@Test
	void aLinkPointingOutsideTheServicesOwnTradeIsRefused() throws Exception {
		RequestPostProcessor token = plumberFor("user_picker_mismatch", "picker-mismatch");
		Job toilet = job("PLUMBER_TOILET_REPLACE");
		String roofer = BusinessFixtures.tradeId(mockMvc, "ROOFER");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.serviceJson("\"catalogId\": \"" + toilet.id() + "\",",
								"Something roofing", roofer, "QUOTE_ONLY", null)))
				.andExpect(status().isBadRequest());
	}

	/** A link to a job that does not exist is the same mistake, and gets the same answer. */
	@Test
	void aLinkToNoJobAtAllIsRefused() throws Exception {
		RequestPostProcessor token = plumberFor("user_picker_ghost", "picker-ghost");
		String plumber = BusinessFixtures.tradeId(mockMvc, "PLUMBER");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.serviceJson(
								"\"catalogId\": \"00000000-0000-4000-8000-000000000000\",",
								"Invented", plumber, "QUOTE_ONLY", null)))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The link has to survive an edit, and this is the test that says so. Correcting a price is
	 * the most ordinary thing a holder does; if it cleared the link, the service would stay, the
	 * screen would look right, and the business would quietly vanish from every search for that
	 * job.
	 */
	@Test
	void editingAServiceKeepsItsCatalogueLink() throws Exception {
		RequestPostProcessor token = plumberFor("user_picker_edit", "picker-edit");
		Job toilet = job("PLUMBER_TOILET_REPLACE");

		String created = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON).content(ticked(toilet)))
				.andReturn().getResponse().getContentAsString();

		String id = JsonPath.read(created, "$.id");
		int version = JsonPath.read(created, "$.version");

		mockMvc.perform(put("/api/v1/me/business/services/" + id).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"tradeId": "%s", "name": "Replace a toilet", \
								"estimatedDurationMinutes": 120, "pricingMode": "FLAT", \
								"price": "340.0000", "version": %d}"""
								.formatted(toilet.tradeId(), version)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estimatedDurationMinutes").value(120))
				.andExpect(jsonPath("$.catalogId").value(toilet.id()));
	}

	/** Nothing about the picker takes the hand-typed path away. */
	@Test
	void aJobTheCatalogueDoesNotKnowIsStillAddable() throws Exception {
		RequestPostProcessor token = plumberFor("user_picker_freetext", "picker-freetext");
		String plumber = BusinessFixtures.tradeId(mockMvc, "PLUMBER");

		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.serviceJson("", "Reglaze a cast iron bathtub",
								plumber, "QUOTE_ONLY", null)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.catalogId").doesNotExist());
	}

	/** What a picker sends for a ticked job: its label as the name, an hour, and no price. */
	private static String ticked(Job job) {
		return BusinessFixtures.serviceJson("\"catalogId\": \"" + job.id() + "\",",
				job.label(), job.tradeId(), "QUOTE_ONLY", null);
	}

	private Job job(String code) throws Exception {
		String body = mockMvc.perform(get("/api/v1/service-jobs"))
				.andReturn().getResponse().getContentAsString();

		return new Job(field(body, code, "id"), field(body, code, "label"), field(body, code, "tradeId"));
	}

	/** A filter expression answers an array, even where exactly one row can match. */
	private static String field(String body, String code, String name) {
		List<String> matched = JsonPath.read(body, "$[?(@.code=='" + code + "')]." + name);
		return matched.getFirst();
	}

	private record Job(String id, String label, String tradeId) {
	}

	private RequestPostProcessor plumberFor(String subject, String slug) throws Exception {
		RequestPostProcessor token = BusinessFixtures.businessFor(mockMvc, subject, slug);
		BusinessFixtures.claimPrimaryTrade(mockMvc, token, "PLUMBER");
		return token;
	}
}
