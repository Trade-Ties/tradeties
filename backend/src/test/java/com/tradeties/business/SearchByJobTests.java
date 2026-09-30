package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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

	private static final String RENAME = """
			UPDATE business_profile SET display_name = ? WHERE slug = ?""";

	/** Inserted rather than posted: there is no endpoint that writes time off yet. */
	private static final String INSERT_TIME_OFF = """
			INSERT INTO availability_time_off (id, business_id, starts_at, ends_at, created_by_user_id,
				created_at, updated_at, version)
			SELECT ?, b.id, ?, ?, b.owner_user_id, now(), now(), 0
			FROM business_profile b WHERE b.slug = ?""";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

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
	 *
	 * <p>Narrowed to a name only these two carry. Unnarrowed, both had to be on the first page of
	 * every plumber the suite had published in Denver by then — true or not depending on the order
	 * the classes happened to run in, which is not the same on every machine.
	 */
	@Test
	void whoListsTheJobComesFirstAndTheRestStillCome() throws Exception {
		publishPlumber("user_job_lists", "job-lists", TOILET);
		publishPlumber("user_job_silent", "job-silent", null);
		jdbcTemplate.update(RENAME, "Quillmarsh Plumbing", "job-lists");
		jdbcTemplate.update(RENAME, "Quillmarsh Pipe & Drain", "job-silent");

		String body = mockMvc.perform(search().param("service", TOILET).param("name", "Quillmarsh"))
				.andExpect(status().isOk())
				.andExpect(jsonPath(at("job-lists") + ".offersThisJob").value(Matchers.contains(true)))
				.andExpect(jsonPath(at("job-silent") + ".offersThisJob").value(Matchers.contains(false)))
				.andReturn().getResponse().getContentAsString();

		List<Boolean> flags = JsonPath.read(body, "$.results[*].offersThisJob");
		assertEveryTrueBeforeEveryFalse(flags);
	}

	/**
	 * The business that lists the job names the service it is listed under, which is what a
	 * booking from the result card names. The one that does not list it has nothing to name.
	 */
	@Test
	void whoListsTheJobNamesItsServiceForIt() throws Exception {
		String listed = publishPlumber("user_job_names", "job-names", TOILET);
		publishPlumber("user_job_nameless", "job-nameless", null);
		// Narrowed for the reason above — and here it matters more: a business off the first page
		// would pass "names no service" without being looked at.
		jdbcTemplate.update(RENAME, "Vorlane Plumbing", "job-names");
		jdbcTemplate.update(RENAME, "Vorlane Pipe & Drain", "job-nameless");

		mockMvc.perform(search().param("service", TOILET).param("name", "Vorlane"))
				.andExpect(jsonPath("$.results.length()").value(2))
				.andExpect(status().isOk())
				.andExpect(jsonPath(at("job-names") + ".serviceId").value(Matchers.contains(listed)))
				.andExpect(jsonPath(at("job-nameless") + ".serviceId").value(Matchers.empty()));
	}

	/**
	 * The openings of a listed job are its service's, so a start taken off the card is one the
	 * service's calendar offers too. Time off from half an hour after the first opening leaves the
	 * grid's thirty minutes from it free and the service's sixty not.
	 *
	 * <p>Narrowed by a name nobody else carries, so the business is on the first page whatever the
	 * rest of the suite has published in Denver.
	 */
	@Test
	void theOpeningsOfAListedJobAreMeasuredByItsService() throws Exception {
		publishPlumber("user_job_length", "job-length", TOILET);
		jdbcTemplate.update(RENAME, "Wexbridge Plumbing", "job-length");

		String first = slotsOf(search().param("name", "Wexbridge")).getFirst();
		Instant start = OffsetDateTime.parse(first).toInstant();
		jdbcTemplate.update(INSERT_TIME_OFF, UUID.randomUUID(),
				start.plus(Duration.ofMinutes(30)).atOffset(ZoneOffset.UTC),
				start.plus(Duration.ofMinutes(60)).atOffset(ZoneOffset.UTC),
				"job-length");

		assertTrue(slotsOf(search().param("name", "Wexbridge")).contains(first),
				"without a job the grid stands in for the length, and thirty minutes still fit");
		assertFalse(slotsOf(search().param("name", "Wexbridge").param("service", TOILET)).contains(first),
				"the listed service runs an hour from " + first + ", into the time off");
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

	private MockHttpServletRequestBuilder search() {
		return get("/api/v1/businesses").param("zip", DENVER);
	}

	/** The openings of the one result a search narrowed to. */
	private List<String> slotsOf(MockHttpServletRequestBuilder search) throws Exception {
		String body = mockMvc.perform(search)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results.length()").value(1))
				.andReturn().getResponse().getContentAsString();

		return JsonPath.read(body, "$.results[0].nextSlots");
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
	 *
	 * @return the id of the service listing the job, or null when none was asked for
	 */
	private String publishPlumber(String subject, String slug, String jobCode) throws Exception {
		RequestPostProcessor token = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);
		String listed = null;

		if (jobCode != null) {
			String jobs = mockMvc.perform(get("/api/v1/service-jobs"))
					.andReturn().getResponse().getContentAsString();
			String filter = "$[?(@.code=='" + jobCode + "')].";

			String created = mockMvc.perform(post("/api/v1/me/business/services").with(token)
							.contentType(MediaType.APPLICATION_JSON)
							.content(BusinessFixtures.serviceJson(
									"\"catalogId\": \"" + first(jobs, filter + "id") + "\",",
									first(jobs, filter + "label"), first(jobs, filter + "tradeId"),
									"QUOTE_ONLY", null)))
					.andExpect(status().isCreated())
					.andReturn().getResponse().getContentAsString();
			listed = JsonPath.read(created, "$.id");
		}

		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, slug, DENVER))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		return listed;
	}

	/** A filter expression answers an array, even where exactly one row can match. */
	private static String first(String body, String path) {
		List<String> matched = JsonPath.read(body, path);
		return matched.getFirst();
	}
}
