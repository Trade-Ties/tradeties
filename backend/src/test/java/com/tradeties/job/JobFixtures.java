package com.tradeties.job;

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

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * A published business with one service, and requests sent to it — the setup every suite about
 * jobs starts from.
 *
 * <p>Every business here is published sixty-five miles from Denver, in Colorado Springs, for the
 * reason the availability suite gives: one shared database, and a plumber in Denver answers other
 * suites' searches.
 */
final class JobFixtures {

	static final ZoneId DENVER = ZoneId.of("America/Denver");
	private static final String COLORADO_SPRINGS = "80903";

	private JobFixtures() {
	}

	/**
	 * The start is read from the availability operation rather than computed, so these tests break
	 * when the calendar changes its mind about what is bookable instead of quietly testing a start
	 * nobody would have been shown.
	 *
	 * @param subject the owner's WorkOS subject — unique per test, like the slug
	 */
	static Booking bookable(MockMvc mockMvc, String subject, String slug, int minutes) throws Exception {
		RequestPostProcessor owner = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);

		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, owner, slug, COLORADO_SPRINGS))
				.andExpect(status().isOk());

		String created = mockMvc.perform(post("/api/v1/me/business/services").with(owner)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"tradeId":"%s","name":"Measured job",
								 "estimatedDurationMinutes":%d,"pricingMode":"QUOTE_ONLY"}"""
								.formatted(BusinessFixtures.tradeId(mockMvc, "PLUMBER"), minutes)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(post("/api/v1/me/business/publish").with(owner)).andExpect(status().isOk());

		String serviceId = JsonPath.read(created, "$.id");
		LocalDate monday = aMondaySoon();

		String openings = mockMvc.perform(get("/api/v1/businesses/{slug}/availability", slug)
						.param("serviceId", serviceId)
						.param("from", monday.toString())
						.param("to", monday.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slots[0]").exists())
				.andReturn().getResponse().getContentAsString();

		return new Booking(slug, serviceId, JsonPath.read(openings, "$.slots[0]"), owner);
	}

	/** Sends a request for the booking's first start and answers with the created job. */
	static String place(MockMvc mockMvc, Booking booking) throws Exception {
		return mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(booking.slug(), booking.serviceId(), booking.firstStart())))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
	}

	static String body(String slug, String serviceId, String startsAt) {
		return """
				{"slug":"%s","serviceId":"%s","startsAt":"%s",
				 "customerName":"Dana Reyes","customerEmail":"dana@example.com",
				 "customerPhone":"+17195550142",
				 "description":"No hot water since Tuesday.",
				 "street1":"1 Main St","street2":"Apt 4","city":"Colorado Springs",
				 "state":"CO","postalCode":"80903"}"""
				.formatted(slug, serviceId, startsAt);
	}

	/** A Monday the notice cannot reach and the horizon still covers. */
	static LocalDate aMondaySoon() {
		return LocalDate.now(DENVER).plusWeeks(1).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
	}

	/**
	 * @param owner the token of the tradesperson who owns the business — what the inbox answers to
	 */
	record Booking(String slug, String serviceId, String firstStart, RequestPostProcessor owner) {

		Booking {
			UUID.fromString(serviceId);
		}
	}
}
