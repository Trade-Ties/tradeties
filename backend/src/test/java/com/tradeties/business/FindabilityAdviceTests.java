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
 * The seventh entry on the publish checklist, and the first that is advice.
 *
 * <p>The six before it are conditions a booking cannot happen without. This one is about being
 * found: a customer who picks a job is answered with the businesses that list it, and a profile
 * listing two is absent from most of those searches. Listing more does not make it more bookable,
 * so it must not hold publishing up — a business that genuinely does two things is not wrong.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class FindabilityAdviceTests {

	private static final String ADVICE = "$.checks[?(@.code=='ENOUGH_JOBS_TO_BE_FOUND')]";

	@Autowired
	MockMvc mockMvc;

	/**
	 * The whole point of the flag. A profile short of the advice still publishes, and
	 * {@code ready} still says so — otherwise this would be a rule wearing a hint's clothes.
	 */
	@Test
	void fallingShortOfTheAdviceStopsNothing() throws Exception {
		RequestPostProcessor token =
				BusinessFixtures.publishableBusinessFor(mockMvc, "user_advice_short", "advice-short");

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.ready").value(true))
				.andExpect(jsonPath(ADVICE + ".passed").value(Matchers.contains(false)))
				.andExpect(jsonPath(ADVICE + ".blocking").value(Matchers.contains(false)));

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk());
	}

	/** The other six are conditions, and nothing about adding a seventh changed that. */
	@Test
	void theConditionsAreStillConditions() throws Exception {
		RequestPostProcessor token =
				BusinessFixtures.publishableBusinessFor(mockMvc, "user_advice_rules", "advice-rules");

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(jsonPath("$.checks[?(@.code=='AT_LEAST_ONE_SERVICE')].blocking")
						.value(Matchers.contains(true)))
				.andExpect(jsonPath("$.checks[?(@.code=='WORKING_HOURS_SET')].blocking")
						.value(Matchers.contains(true)));
	}

	/**
	 * Counted by catalogue link and not by service, which is the only measure that means anything:
	 * the search follows the link, so services typed by hand make a profile no more findable than
	 * none at all.
	 */
	@Test
	void onlyJobsTheSearchCanFollowAreCounted() throws Exception {
		RequestPostProcessor token =
				BusinessFixtures.publishableBusinessFor(mockMvc, "user_advice_typed", "advice-typed");
		String plumber = BusinessFixtures.tradeId(mockMvc, "PLUMBER");

		for (String name : List.of("Something I typed", "Another thing I typed", "A third")) {
			mockMvc.perform(post("/api/v1/me/business/services").with(token)
							.contentType(MediaType.APPLICATION_JSON)
							.content(BusinessFixtures.serviceJson("", name, plumber, "QUOTE_ONLY", null)))
					.andExpect(status().isCreated());
		}

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(jsonPath(ADVICE + ".passed").value(Matchers.contains(false)))
				.andExpect(jsonPath(ADVICE + ".detail")
						.value(Matchers.contains(Matchers.startsWith("Customers can find you for 0"))));
	}

	/** And met once enough jobs the search can follow are listed. */
	@Test
	void theAdviceIsMetByPickingEnoughJobs() throws Exception {
		RequestPostProcessor token =
				BusinessFixtures.publishableBusinessFor(mockMvc, "user_advice_picked", "advice-picked");

		String jobs = mockMvc.perform(get("/api/v1/service-jobs"))
				.andReturn().getResponse().getContentAsString();
		List<String> ids = JsonPath.read(jobs, "$[?(@.tradeId=='" + BusinessFixtures.tradeId(mockMvc, "PLUMBER") + "')].id");
		List<String> labels = JsonPath.read(jobs, "$[?(@.tradeId=='" + BusinessFixtures.tradeId(mockMvc, "PLUMBER") + "')].label");
		String plumber = BusinessFixtures.tradeId(mockMvc, "PLUMBER");

		for (int i = 0; i < 5; i++) {
			mockMvc.perform(post("/api/v1/me/business/services").with(token)
							.contentType(MediaType.APPLICATION_JSON)
							.content(BusinessFixtures.serviceJson(
									"\"catalogId\": \"" + ids.get(i) + "\",",
									labels.get(i), plumber, "QUOTE_ONLY", null)))
					.andExpect(status().isCreated());
		}

		mockMvc.perform(get("/api/v1/me/business/readiness").with(token))
				.andExpect(jsonPath(ADVICE + ".passed").value(Matchers.contains(true)))
				.andExpect(jsonPath(ADVICE + ".blocking").value(Matchers.contains(false)));
	}
}
