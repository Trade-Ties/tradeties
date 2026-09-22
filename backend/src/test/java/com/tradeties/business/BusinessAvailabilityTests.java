package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
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
 * One business's free slots, read without a token and with a service in hand.
 *
 * <p>{@link #offersTheSameStartsWhateverTheWorkTakes} is the test to keep. The rest wire the
 * operation up; that one pins the rule the list is built on — the grid says where work may begin,
 * the service says how long it then runs, and a start is offered even when the work outlasts the
 * working block. The tradesperson answers that on the request.
 *
 * <p>Every date here is worked out from today rather than written down, because the fixture's
 * working week is a weekday and a fixed date would pass until it fell on a Sunday. A Monday at
 * least a week out is far enough that the day of notice in the default rules cannot reach it and
 * near enough to sit inside the sixty-day horizon, so neither bound moves and the assertions are
 * about the block and the appointment alone.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BusinessAvailabilityTests {

	private static final ZoneId DENVER = ZoneId.of("America/Denver");

	/**
	 * Where these businesses are put, and it is not decoration.
	 *
	 * <p>Every suite in this build shares one database, and the fixture publishes a plumber into
	 * Denver with a twenty-five mile radius — which is a plumber that answers every search the
	 * search suites run. Seven of them is enough to push somebody else's fixture off a page of
	 * twenty-four, and the test that fails is theirs rather than the one that caused it.
	 *
	 * <p>Sixty-five miles south, the same radius reaches nobody. Nothing here searches, so the
	 * distance costs these tests nothing; the zone is still Denver, which is what the slots are
	 * read in.
	 */
	private static final String COLORADO_SPRINGS = "80903";

	@Autowired
	MockMvc mockMvc;

	/** The rule the whole customer side rests on, asked of the calendar as well. */
	@Test
	void answersWithoutATokenAndSaysWhatItMeasured() throws Exception {
		String service = publish("user_av_open", "av-open", 120);
		LocalDate monday = aMondaySoon();

		mockMvc.perform(get("/api/v1/businesses/{slug}/availability", "av-open")
						.param("serviceId", service)
						.param("from", monday.toString())
						.param("to", monday.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.serviceId").value(service))
				.andExpect(jsonPath("$.timeZone").value("America/Denver"))
				.andExpect(jsonPath("$.appointmentMinutes").value(120))
				.andExpect(jsonPath("$.from").value(monday.toString()))
				.andExpect(jsonPath("$.to").value(monday.toString()))
				.andExpect(jsonPath("$.slotsCapped").value(false));
	}

	/**
	 * The fixture opens 09:00–17:00 on a half-hour grid, which is sixteen starts, the last at
	 * 16:30. Two hours from 16:30 runs to 18:30 and the start is offered anyway.
	 *
	 * <p>Both lengths in one test, because either alone is a number somebody can make pass. The
	 * pair is the statement: the same block answers the same for different work, and what the
	 * length changes is the span the client draws from `appointmentMinutes`, not the list.
	 */
	@Test
	void offersTheSameStartsWhateverTheWorkTakes() throws Exception {
		assertStartsOnAMonday("user_av_long", "av-long", 120, 16);
		assertStartsOnAMonday("user_av_short", "av-short", 30, 16);
	}

	/**
	 * A service is a business's own, so one filed under another business is not a narrower search
	 * here — it is a question about a pairing that does not exist.
	 *
	 * <p>Answered 400 rather than with an empty list, the same way the search answers a postal
	 * code the Census does not list. It reaches here from a page that has since gone stale, and
	 * "nobody is free" would send the reader off to try another week instead of reloading.
	 */
	@Test
	void aServiceFiledUnderAnotherBusinessIsRefused() throws Exception {
		publish("user_av_mine", "av-mine", 60);
		String theirs = publish("user_av_theirs", "av-theirs", 60);

		LocalDate monday = aMondaySoon();

		mockMvc.perform(get("/api/v1/businesses/{slug}/availability", "av-mine")
						.param("serviceId", theirs)
						.param("from", monday.toString())
						.param("to", monday.toString()))
				.andExpect(status().isBadRequest());
	}

	/**
	 * A draft is nobody's to find and nobody's calendar to read either — the same 404 the profile
	 * itself answers, and for the same reason: a calendar that existed for a profile that does not
	 * would give away which slugs are taken.
	 */
	@Test
	void anUnpublishedProfileHasNoCalendar() throws Exception {
		BusinessFixtures.publishableBusinessFor(mockMvc, "user_av_draft", "av-draft");

		LocalDate monday = aMondaySoon();

		mockMvc.perform(get("/api/v1/businesses/{slug}/availability", "av-draft")
						.param("serviceId", UUID.randomUUID().toString())
						.param("from", monday.toString())
						.param("to", monday.toString()))
				.andExpect(status().isNotFound());
	}

	/**
	 * Asking for three months answers for the first one and says so, rather than refusing. The
	 * window that comes back is what makes that readable — without it, a client would have to
	 * assume the two months of silence were empty rather than unread.
	 */
	@Test
	void aWindowWiderThanAMonthIsShortened() throws Exception {
		String service = publish("user_av_wide", "av-wide", 60);
		LocalDate monday = aMondaySoon();

		mockMvc.perform(get("/api/v1/businesses/{slug}/availability", "av-wide")
						.param("serviceId", service)
						.param("from", monday.toString())
						.param("to", monday.plusDays(90).toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.from").value(monday.toString()))
				.andExpect(jsonPath("$.to").value(monday.plusDays(31).toString()));
	}

	/**
	 * The one window refused rather than shortened. Every other way of asking for too much has a
	 * nearest true answer to be cut back to; this one has none, and no customer typed it.
	 */
	@Test
	void aWindowThatEndsBeforeItBeginsIsRefused() throws Exception {
		String service = publish("user_av_back", "av-back", 60);
		LocalDate monday = aMondaySoon();

		mockMvc.perform(get("/api/v1/businesses/{slug}/availability", "av-back")
						.param("serviceId", service)
						.param("from", monday.toString())
						.param("to", monday.minusDays(1).toString()))
				.andExpect(status().isBadRequest());
	}

	private void assertStartsOnAMonday(String subject, String slug, int minutes, int expected)
			throws Exception {

		String service = publish(subject, slug, minutes);
		LocalDate monday = aMondaySoon();

		mockMvc.perform(get("/api/v1/businesses/{slug}/availability", slug)
						.param("serviceId", service)
						.param("from", monday.toString())
						.param("to", monday.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slots.length()").value(expected));
	}

	/**
	 * A published business with one service of the given length, and its id.
	 *
	 * <p>The service is added rather than the fixture's own reused, because the fixture fixes the
	 * duration at an hour and the length is the whole subject here.
	 */
	private String publish(String subject, String slug, int minutes) throws Exception {
		RequestPostProcessor token = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);

		// Out of everybody else's search results before it goes live — see COLORADO_SPRINGS.
		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, slug, COLORADO_SPRINGS))
				.andExpect(status().isOk());

		String body = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"tradeId":"%s","name":"Measured job",
								 "estimatedDurationMinutes":%d,"pricingMode":"QUOTE_ONLY"}"""
								.formatted(BusinessFixtures.tradeId(mockMvc, "PLUMBER"), minutes)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		return JsonPath.read(body, "$.id");
	}

	/** A Monday the notice cannot reach and the horizon still covers. */
	private static LocalDate aMondaySoon() {
		return LocalDate.now(DENVER).plusWeeks(1).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
	}
}
