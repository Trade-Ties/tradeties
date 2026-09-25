package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * Searching by the job a customer picked, rather than by a trade read out of their sentence.
 *
 * <p>Two businesses carry every case: one that lists the picked job and one that does not, both
 * plumbers reaching the same postal code. The point of the slice is that the second is still
 * shown — service lists average three entries for businesses that do thirty kinds of work, so
 * "does not list it" is not "cannot do it" — but it is shown second, and says so.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SearchByJobTests {

	private static final String DENVER = "80202";

	/** The catalogue job these tests pick, and the one the report that started this named. */
	private static final String TOILET = "PLUMBER_TOILET_REPLACE";

	@Autowired
	MockMvc mockMvc;

	/**
	 * A picked job is a choice, not a reading, so nothing is guessed from the prose beside it.
	 * The answer says which job it was, which is what lets a client draw a removable chip instead
	 * of "Plumber" — the thing the customer asked for rather than the thing inferred from it.
	 */
	@Test
	void theAnswerNamesTheJobThatWasPicked() throws Exception {
		mockMvc.perform(search().param("service", TOILET))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.matchedService.code").value(TOILET))
				.andExpect(jsonPath("$.matchedService.label").value("Replace a toilet"))
				.andExpect(jsonPath("$.matchedTrades[0].code").value("PLUMBER"));
	}

	/**
	 * The whole slice in one assertion: the business that lists the job comes first and says so,
	 * the one that does not is still there and says that.
	 */
	@Test
	void whoListsTheJobComesFirstAndTheRestStillCome() throws Exception {
		publishPlumber("user_job_lists", "job-lists", TOILET);
		publishPlumber("user_job_silent", "job-silent", null);

		String body = mockMvc.perform(search().param("service", TOILET))
				.andExpect(status().isOk())
				.andExpect(jsonPath(at("job-lists") + ".offersThisJob").value(Matchers.contains(true)))
				.andExpect(jsonPath(at("job-silent") + ".offersThisJob").value(Matchers.contains(false)))
				.andReturn().getResponse().getContentAsString();

		List<Boolean> flags = JsonPath.read(body, "$.results[*].offersThisJob");
		assertEveryTrueBeforeEveryFalse(flags);
	}

	/**
	 * Absent is not false, and a client that draws them alike tells somebody a business cannot
	 * help before anybody asked whether it could.
	 */
	@Test
	void withNoJobPickedNobodyIsAskedAboutOne() throws Exception {
		publishPlumber("user_job_unasked", "job-unasked", TOILET);

		mockMvc.perform(search())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.matchedService").doesNotExist())
				.andExpect(jsonPath(at("job-unasked") + ".offersThisJob").value(Matchers.empty()));
	}

	/**
	 * The report that started all of this: "Toilet is leaking" reached roofers, because roofing
	 * carries the word {@code leak}. V20's word coverage already fixed the reading; picking the
	 * job removes the reading altogether.
	 */
	@Test
	void pickingAJobReplacesTheGuessRatherThanAddingToIt() throws Exception {
		mockMvc.perform(search().param("job", "Toilet is leaking").param("service", TOILET))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.matchedTrades.length()").value(1))
				.andExpect(jsonPath("$.matchedTrades[0].code").value("PLUMBER"))
				.andExpect(jsonPath("$.matchedService.code").value(TOILET));
	}

	/** Narrowed to the job's own trade, so a roofer is not among the answers whatever it lists. */
	@Test
	void onlyTheJobsOwnTradeIsAnswered() throws Exception {
		RequestPostProcessor roofer = BusinessFixtures.publishableBusinessFor(
				mockMvc, "user_job_roofer", "job-roofer", "ROOFER");
		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, roofer, "job-roofer", DENVER))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/me/business/publish").with(roofer)).andExpect(status().isOk());

		mockMvc.perform(search().param("service", TOILET))
				.andExpect(jsonPath(at("job-roofer")).value(Matchers.empty()));
	}

	/**
	 * A code from a stale link or a hand-edited URL. Refused rather than answered empty, for the
	 * reason an unknown postal code is: "nobody near you does this" would send somebody to widen
	 * a search that was never narrow.
	 */
	@Test
	void aJobTheCatalogueDoesNotListIsRefused() throws Exception {
		mockMvc.perform(search().param("service", "NO_SUCH_JOB"))
				.andExpect(status().isBadRequest());
	}

	private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder search() {
		return get("/api/v1/businesses").param("zip", DENVER);
	}

	private static String at(String slug) {
		return "$.results[?(@.slug=='" + slug + "')]";
	}

	/** The contract promises one divider is enough, which is only true if the flags are grouped. */
	private static void assertEveryTrueBeforeEveryFalse(List<Boolean> flags) {
		boolean seenFalse = false;
		for (Boolean flag : flags) {
			if (Boolean.FALSE.equals(flag)) {
				seenFalse = true;
			}
			else if (seenFalse) {
				throw new AssertionError("a listed job came after an unlisted one: " + flags);
			}
		}
	}

	/**
	 * A published plumber in Denver, optionally listing one catalogue job.
	 *
	 * <p>The link is written through the API the picker uses, which is the point of the previous
	 * slice: a service carries the job it answers from the moment it is created.
	 */
	private void publishPlumber(String subject, String slug, String jobCode) throws Exception {
		RequestPostProcessor token = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);

		if (jobCode != null) {
			String jobs = mockMvc.perform(get("/api/v1/service-jobs"))
					.andReturn().getResponse().getContentAsString();
			String filter = "$[?(@.code=='" + jobCode + "')].";

			mockMvc.perform(post("/api/v1/me/business/services").with(token)
							.contentType(MediaType.APPLICATION_JSON)
							.content(BusinessFixtures.serviceJson(
									"\"catalogId\": \"" + first(jobs, filter + "id") + "\",",
									first(jobs, filter + "label"), first(jobs, filter + "tradeId"),
									"QUOTE_ONLY", null)))
					.andExpect(status().isCreated());
		}

		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, slug, DENVER))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());
	}

	/** A filter expression answers an array, even where exactly one row can match. */
	private static String first(String body, String path) {
		List<String> matched = JsonPath.read(body, path);
		return matched.getFirst();
	}
}
