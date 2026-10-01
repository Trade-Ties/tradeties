package com.tradeties.job;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

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
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The tradesperson answering the requests customers sent.
 *
 * <p>Every request here is created through the public endpoint rather than inserted, because the
 * two halves have to agree about one row: what the customer was shown is what the tradesperson
 * decides on, and a fixture writing the row directly could make them agree by accident.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class InboxTests {

	private static final ZoneId DENVER = ZoneId.of("America/Denver");
	private static final String COLORADO_SPRINGS = "80903";

	@Autowired
	MockMvc mockMvc;

	/** Nothing under `/me/business` is readable without a token, this included. */
	@Test
	void refusesToShowAnInboxWithoutAToken() throws Exception {
		mockMvc.perform(get("/api/v1/me/business/job-requests")).andExpect(status().isUnauthorized());
	}

	/**
	 * The inbox carries what a decision needs: who to call, where to go, what they said is wrong,
	 * and the terms the request was sent under — the snapshot rather than today's profile.
	 */
	@Test
	void showsEverythingADecisionNeeds() throws Exception {
		Business acme = publish("user_inbox_read", "inbox-read", 60);
		send(acme, "Dana Reyes", "dana@example.com");

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].status").value("PENDING"))
				.andExpect(jsonPath("$[0].customerName").value("Dana Reyes"))
				.andExpect(jsonPath("$[0].customerEmail").value("dana@example.com"))
				.andExpect(jsonPath("$[0].preferredContact").value("PHONE"))
				.andExpect(jsonPath("$[0].description").value("No hot water since Tuesday."))
				.andExpect(jsonPath("$[0].street1").value("1 Main St"))
				.andExpect(jsonPath("$[0].city").value("Colorado Springs"))
				.andExpect(jsonPath("$[0].serviceName").value("Measured job"))
				.andExpect(jsonPath("$[0].estimatedDurationMinutes").value(60))
				.andExpect(jsonPath("$[0].cancellationFee").exists())
				.andExpect(jsonPath("$[0].timeZone").value("America/Denver"))
				.andExpect(jsonPath("$[0].requestedAt").exists())
				.andExpect(jsonPath("$[0].decidedAt").doesNotExist());
	}

	/**
	 * One business must not read another's inbox, and the requests are what proves it — both were
	 * sent to a real business, so an empty list here can only come from the filter working.
	 */
	@Test
	void showsOnlyThisBusinessesOwnRequests() throws Exception {
		Business mine = publish("user_inbox_mine", "inbox-mine", 60);
		Business theirs = publish("user_inbox_theirs", "inbox-theirs", 60);
		send(theirs, "Somebody Else", "else@example.com");

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(mine.token()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	/**
	 * Accepting takes the hour off everybody else's calendar, which is the whole point of the
	 * slice: free slots are working hours less time off less accepted appointments, so the start
	 * that was on offer before is gone afterwards.
	 */
	@Test
	void acceptingTakesTheHourOffTheCalendar() throws Exception {
		Business acme = publish("user_inbox_take", "inbox-take", 60);
		String start = acme.firstStart();
		String requestId = send(acme, "Dana Reyes", "dana@example.com");

		assertTrue(stillOffers(acme, start), "the hour is on offer before anybody takes it");

		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/accept", requestId).with(acme.token()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ACCEPTED"))
				.andExpect(jsonPath("$.decidedAt").exists());

		assertFalse(stillOffers(acme, start), "and gone once it is accepted");
	}

	/**
	 * Two customers may both hold a request on one hour — that is correct until somebody accepts.
	 * The second acceptance is the one that loses, and it loses with a 409 because re-reading and
	 * trying again is a move that could genuinely succeed another day.
	 */
	@Test
	void refusesASecondAcceptanceOnTheSameHour() throws Exception {
		Business acme = publish("user_inbox_race", "inbox-race", 60);
		String first = send(acme, "Dana Reyes", "dana@example.com");
		String second = send(acme, "Sam Tan", "sam@example.com");

		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/accept", first).with(acme.token()))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/accept", second).with(acme.token()))
				.andExpect(status().isConflict());
	}

	/** Answered once is answered: no retry reopens it, which is why this is a 422 and not a 409. */
	@Test
	void refusesToAnswerARequestTwice() throws Exception {
		Business acme = publish("user_inbox_twice", "inbox-twice", 60);
		String requestId = send(acme, "Dana Reyes", "dana@example.com");

		mockMvc.perform(declining(acme, requestId, "Booked that morning already."))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DECLINED"))
				.andExpect(jsonPath("$.declineReason").value("Booked that morning already."));

		mockMvc.perform(declining(acme, requestId, "Again."))
				.andExpect(status().isUnprocessableEntity());
	}

	/**
	 * A declined request leaves the hour alone. It is the record of a decision and of what was
	 * asked for, so the row stays — and the calendar, which only subtracts accepted appointments,
	 * never noticed it.
	 */
	@Test
	void decliningLeavesTheHourFree() throws Exception {
		Business acme = publish("user_inbox_decline", "inbox-decline", 60);
		String start = acme.firstStart();
		String requestId = send(acme, "Dana Reyes", "dana@example.com");

		mockMvc.perform(declining(acme, requestId, "Outside the area I cover.")).andExpect(status().isOk());

		assertTrue(stillOffers(acme, start), "a declined request never held the hour");
		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token())
						.param("status", "DECLINED"))
				.andExpect(jsonPath("$.length()").value(1));
	}

	/** A reason is worth giving but not required: a blank one declines without one, stored as nothing. */
	@Test
	void declinesWithoutAReason() throws Exception {
		Business acme = publish("user_inbox_why", "inbox-why", 60);
		String requestId = send(acme, "Dana Reyes", "dana@example.com");

		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/decline", requestId).with(acme.token())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"reason\":\"   \"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DECLINED"))
				.andExpect(jsonPath("$.declineReason").doesNotExist());
	}

	/** Somebody else's request is not found rather than forbidden — a 403 confirms the id. */
	@Test
	void willNotAnswerAnotherBusinessesRequest() throws Exception {
		Business mine = publish("user_inbox_a", "inbox-a", 60);
		Business theirs = publish("user_inbox_b", "inbox-b", 60);
		String requestId = send(theirs, "Dana Reyes", "dana@example.com");

		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/accept", requestId).with(mine.token()))
				.andExpect(status().isNotFound());
	}

	/**
	 * Whether the public calendar still offers that exact start.
	 *
	 * <p>Asked of the same operation a customer asks, rather than of the table. The subtraction
	 * this slice adds happens inside that walk, and a test reading the rows instead would pass
	 * against a walk that had forgotten to do it.
	 */
	private boolean stillOffers(Business business, String start) throws Exception {
		String body = mockMvc.perform(get("/api/v1/businesses/{slug}/availability", business.slug())
						.param("serviceId", business.serviceId())
						.param("from", aMondaySoon().toString())
						.param("to", aMondaySoon().toString()))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		List<String> slots = JsonPath.read(body, "$.slots");
		return slots.contains(start);
	}

	private RequestBuilder declining(Business business, String requestId, String reason) {

		return post("/api/v1/me/business/job-requests/{id}/decline", requestId).with(business.token())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"reason\":\"%s\"}".formatted(reason));
	}

	private String send(Business business, String name, String email) throws Exception {
		String body = mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"slug":"%s","serviceId":"%s","startsAt":"%s",
								 "customerName":"%s","customerEmail":"%s","customerPhone":"+17195550142",
								 "preferredContact":"PHONE",
								 "description":"No hot water since Tuesday.",
								 "street1":"1 Main St","city":"Colorado Springs",
								 "state":"CO","postalCode":"80903"}"""
								.formatted(business.slug(), business.serviceId(), business.firstStart(), name, email)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		return JsonPath.read(body, "$.request.id");
	}

	private Business publish(String subject, String slug, int minutes) throws Exception {
		RequestPostProcessor token = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);

		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, slug, COLORADO_SPRINGS))
				.andExpect(status().isOk());

		String created = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"tradeId":"%s","name":"Measured job",
								 "estimatedDurationMinutes":%d,"pricingMode":"QUOTE_ONLY"}"""
								.formatted(BusinessFixtures.tradeId(mockMvc, "PLUMBER"), minutes)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		String serviceId = JsonPath.read(created, "$.id");
		LocalDate monday = aMondaySoon();

		String openings = mockMvc.perform(get("/api/v1/businesses/{slug}/availability", slug)
						.param("serviceId", serviceId)
						.param("from", monday.toString())
						.param("to", monday.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slots[0]").exists())
				.andReturn().getResponse().getContentAsString();

		return new Business(slug, serviceId, JsonPath.read(openings, "$.slots[0]"), token);
	}

	/** A Monday the notice cannot reach and the horizon still covers. */
	private static LocalDate aMondaySoon() {
		return LocalDate.now(DENVER).plusWeeks(1).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
	}

	private record Business(String slug, String serviceId, String firstStart, RequestPostProcessor token) {
	}
}
