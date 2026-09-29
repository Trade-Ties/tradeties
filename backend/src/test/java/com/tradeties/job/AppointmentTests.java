package com.tradeties.job;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Appointments a business puts in its own calendar, against the real calendar and the requests
 * customers send through the public endpoint.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AppointmentTests {

	private static final ZoneId DENVER = ZoneId.of("America/Denver");
	private static final String COLORADO_SPRINGS = "80903";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/** Accepted from the start, marked as the business's own, and off the calendar at once. */
	@Test
	void booksACustomerInDirectly() throws Exception {
		Business acme = publish("user_appt_book", "appt-book");
		LocalDate monday = aMondaySoon();
		assertTrue(stillOffers(acme, at(monday, 10)), "the hour is on offer before it is booked");

		String booked = mockMvc.perform(booking(acme, """
						{"serviceId":"%s","startsAt":"%sT10:00","endsAt":"%sT11:30",
						 "customerName":"Pat Lee","customerPhone":"+17195550199",
						 "customerEmail":"pat@example.com","street1":"9 Elm St","city":"Colorado Springs",
						 "state":"CO","postalCode":"80903","notes":"Annual boiler check"}"""
						.formatted(acme.serviceId(), monday, monday)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("ACCEPTED"))
				.andExpect(jsonPath("$.bookedBy").value("BUSINESS"))
				.andExpect(jsonPath("$.detailsFrom").value("BUSINESS"))
				.andExpect(jsonPath("$.serviceName").value("Measured job"))
				.andExpect(jsonPath("$.customerName").value("Pat Lee"))
				.andExpect(jsonPath("$.description").value("Annual boiler check"))
				.andExpect(jsonPath("$.endsAt").value(at(monday, 11).replace(":00:00Z", ":30:00Z")))
				.andReturn().getResponse().getContentAsString();

		assertFalse(stillOffers(acme, at(monday, 10)), "and gone once it is booked");
		assertEquals(List.of("BUSINESS:ACCEPTED"), history(JsonPath.read(booked, "$.id")));
	}

	/** The tradesperson may already know the rest. */
	@Test
	void needsNothingOfTheCustomerButAName() throws Exception {
		Business acme = publish("user_appt_name", "appt-name");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(booking(acme, minimal(acme, monday, 10, 11, "Pat Lee")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.customerEmail").doesNotExist())
				.andExpect(jsonPath("$.street1").doesNotExist());
	}

	@Test
	void refusesAServiceThatIsNotTheBusinesss() throws Exception {
		Business acme = publish("user_appt_mine", "appt-mine");
		Business other = publish("user_appt_theirs", "appt-theirs");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(booking(acme, minimal(other, monday, 10, 11, "Pat Lee")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").value("urn:tradeties:problem:invalid-selection"));
	}

	/** Never overlapped: what is in the way is named, so it can be moved or removed. */
	@Test
	void namesTheAppointmentsInTheWay() throws Exception {
		Business acme = publish("user_appt_overlap", "appt-overlap");
		LocalDate monday = aMondaySoon();
		String first = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 10, 12, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());

		mockMvc.perform(booking(acme, minimal(acme, monday, 11, 13, "Sam Tan")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.type").value("urn:tradeties:problem:appointment-conflicts"))
				.andExpect(jsonPath("$.conflicts.length()").value(1))
				.andExpect(jsonPath("$.conflicts[0].requestId").value(first))
				.andExpect(jsonPath("$.conflicts[0].customerName").value("Pat Lee"))
				.andExpect(jsonPath("$.conflicts[0].bookedBy").value("BUSINESS"));
	}

	@Test
	void movesWhatIsInTheWay() throws Exception {
		Business acme = publish("user_appt_make_room", "appt-make-room");
		LocalDate monday = aMondaySoon();
		String first = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 10, 12, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());

		mockMvc.perform(booking(acme, answered(minimal(acme, monday, 11, 13, "Sam Tan"),
						first, "MOVE", monday + "T14:00", monday + "T16:00")))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token()))
				.andExpect(jsonPath("$[?(@.id=='%s')].startsAt".formatted(first)).value(at(monday, 14)))
				.andExpect(jsonPath("$[?(@.id=='%s')].status".formatted(first)).value("ACCEPTED"));
		assertEquals(List.of("BUSINESS:ACCEPTED", "BUSINESS:ACCEPTED"), history(first));
	}

	@Test
	void removesWhatIsInTheWay() throws Exception {
		Business acme = publish("user_appt_clear", "appt-clear");
		LocalDate monday = aMondaySoon();
		String first = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 10, 12, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());

		mockMvc.perform(booking(acme, answered(minimal(acme, monday, 11, 13, "Sam Tan"), first, "CANCEL", null, null)))
				.andExpect(status().isCreated());

		assertEquals(List.of("BUSINESS:ACCEPTED", "BUSINESS:CANCELLED"), history(first));
	}

	/** A move lands on free time or not at all — and then nothing of the rearrangement is written. */
	@Test
	void refusesAMoveOntoTakenTime() throws Exception {
		Business acme = publish("user_appt_taken", "appt-taken");
		LocalDate monday = aMondaySoon();
		String first = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 10, 12, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());
		mockMvc.perform(booking(acme, minimal(acme, monday, 14, 15, "Kim Ray"))).andExpect(status().isCreated());

		mockMvc.perform(booking(acme, answered(minimal(acme, monday, 11, 13, "Sam Tan"),
						first, "MOVE", monday + "T14:30", monday + "T15:30")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.conflicts").doesNotExist());

		assertEquals(List.of("BUSINESS:ACCEPTED"), history(first));
	}

	/** Two appointments trading places overlap between the two updates; only the end state counts. */
	@Test
	void twoAppointmentsTradePlaces() throws Exception {
		Business acme = publish("user_appt_swap", "appt-swap");
		LocalDate monday = aMondaySoon();
		String morning = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 10, 11, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());
		String afternoon = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 14, 15, "Kim Ray")))
				.andReturn().getResponse().getContentAsString());

		String swapped = change(monday, 14, 15, "Pat Lee");
		mockMvc.perform(changing(acme, morning, swapped.substring(0, swapped.length() - 1)
						+ ",\"resolutions\":[{\"requestId\":\"%s\",\"action\":\"MOVE\",\"startsAt\":\"%sT10:00\",\"endsAt\":\"%sT11:00\"}]}"
								.formatted(afternoon, monday, monday)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.startsAt").value(at(monday, 14)));

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token()))
				.andExpect(jsonPath("$[?(@.id=='%s')].startsAt".formatted(afternoon)).value(at(monday, 10)));
	}

	/** A new appointment never falls into time off; the business shortens the time off first. */
	@Test
	void refusesToFallIntoTimeOff() throws Exception {
		Business acme = publish("user_appt_away", "appt-away");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(post("/api/v1/me/business/time-off").with(acme.token())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"allDay\":true,\"firstDay\":\"%s\",\"lastDay\":\"%s\"}".formatted(monday, monday)))
				.andExpect(status().isCreated());

		mockMvc.perform(booking(acme, minimal(acme, monday, 10, 11, "Pat Lee"))).andExpect(status().isConflict());
	}

	/**
	 * A time agreed in place of the one asked for: the request is declined in the same step, and the
	 * appointment keeps the customer's own details rather than what the form sent.
	 */
	@Test
	void replacesAPendingRequestWithTheTimeAgreed() throws Exception {
		Business acme = publish("user_appt_replace", "appt-replace");
		String requestId = send(acme, "Dana Reyes");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(booking(acme, replacing(minimal(acme, monday, 13, 14, "Ignored Name"), requestId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.bookedBy").value("BUSINESS"))
				.andExpect(jsonPath("$.detailsFrom").value("CUSTOMER"))
				.andExpect(jsonPath("$.customerName").value("Dana Reyes"))
				.andExpect(jsonPath("$.description").value("No hot water since Tuesday."));

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token()).param("status", "DECLINED"))
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].id").value(requestId))
				.andExpect(jsonPath("$[0].declineReason").value(Matchers.startsWith("Moved to Mon, ")));
	}

	@Test
	void refusesToReplaceARequestAlreadyAnswered() throws Exception {
		Business acme = publish("user_appt_answered", "appt-answered");
		String requestId = send(acme, "Dana Reyes");
		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/decline", requestId).with(acme.token())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"reason\":\"Booked that morning.\"}"))
				.andExpect(status().isOk());
		LocalDate monday = aMondaySoon();

		mockMvc.perform(booking(acme, replacing(minimal(acme, monday, 13, 14, "Dana Reyes"), requestId)))
				.andExpect(status().isUnprocessableEntity());
	}

	@Test
	void movesItsOwnAppointmentAndFreesTheOldTime() throws Exception {
		Business acme = publish("user_appt_move", "appt-move");
		LocalDate monday = aMondaySoon();
		String id = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 10, 11, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());

		mockMvc.perform(changing(acme, id, change(monday, 14, 15, "Pat Lee")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.startsAt").value(at(monday, 14)));

		assertTrue(stillOffers(acme, at(monday, 10)), "the old hour is on offer again");
	}

	/** An accepted customer appointment moves and goes like the business's own; their words stay theirs. */
	@Test
	void movesAndRemovesAnAppointmentACustomerAskedFor() throws Exception {
		Business acme = publish("user_appt_theirs_move", "appt-theirs-move");
		String requestId = send(acme, "Dana Reyes");
		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/accept", requestId).with(acme.token()))
				.andExpect(status().isOk());
		LocalDate monday = aMondaySoon();

		mockMvc.perform(changing(acme, requestId, change(monday, 14, 15, "Somebody Else")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.startsAt").value(at(monday, 14)))
				.andExpect(jsonPath("$.customerName").value("Dana Reyes"));

		mockMvc.perform(delete("/api/v1/me/business/appointments/{id}", requestId).with(acme.token()))
				.andExpect(status().isNoContent());
		assertEquals(List.of("CUSTOMER:PENDING", "BUSINESS:ACCEPTED", "BUSINESS:ACCEPTED", "BUSINESS:CANCELLED"),
				history(requestId));
	}

	/** A request still waiting is answered, not moved. */
	@Test
	void leavesAPendingRequestToBeAnswered() throws Exception {
		Business acme = publish("user_appt_pending", "appt-pending");
		String requestId = send(acme, "Dana Reyes");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(changing(acme, requestId, change(monday, 14, 15, "Dana Reyes")))
				.andExpect(status().isUnprocessableEntity());
		mockMvc.perform(delete("/api/v1/me/business/appointments/{id}", requestId).with(acme.token()))
				.andExpect(status().isUnprocessableEntity());
	}

	/** Details the customer typed are theirs; details the business typed are the business's to fix. */
	@Test
	void correctsDetailsOnlyWhereTheBusinessEnteredThem() throws Exception {
		Business acme = publish("user_appt_details", "appt-details");
		String requestId = send(acme, "Dana Reyes");
		LocalDate monday = aMondaySoon();
		String inPlace = idOf(mockMvc.perform(booking(acme, replacing(minimal(acme, monday, 13, 14, "x"), requestId)))
				.andReturn().getResponse().getContentAsString());
		String own = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 15, 16, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());

		mockMvc.perform(changing(acme, inPlace, change(monday, 13, 14, "Somebody Else")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.customerName").value("Dana Reyes"));
		mockMvc.perform(changing(acme, own, change(monday, 15, 16, "Pat Leigh")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.customerName").value("Pat Leigh"));
	}

	/** Recorded as the business's cancellation, never deleted, and the time is free again. */
	@Test
	void removesItsOwnAppointment() throws Exception {
		Business acme = publish("user_appt_remove", "appt-remove");
		LocalDate monday = aMondaySoon();
		String id = idOf(mockMvc.perform(booking(acme, minimal(acme, monday, 10, 11, "Pat Lee")))
				.andReturn().getResponse().getContentAsString());

		mockMvc.perform(delete("/api/v1/me/business/appointments/{id}", id).with(acme.token()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token()))
				.andExpect(jsonPath("$[0].status").value("CANCELLED"));
		assertTrue(stillOffers(acme, at(monday, 10)), "the hour is on offer again");
		assertEquals(List.of("BUSINESS:ACCEPTED", "BUSINESS:CANCELLED"), history(id));

		mockMvc.perform(delete("/api/v1/me/business/appointments/{id}", id).with(acme.token()))
				.andExpect(status().isUnprocessableEntity());
	}

	private RequestBuilder booking(Business business, String body) {
		return post("/api/v1/me/business/appointments").with(business.token())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private RequestBuilder changing(Business business, String requestId, String body) {
		return put("/api/v1/me/business/appointments/{id}", requestId).with(business.token())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private static String minimal(Business business, LocalDate day, int fromHour, int toHour, String name) {
		return """
				{"serviceId":"%s","startsAt":"%sT%02d:00","endsAt":"%sT%02d:00","customerName":"%s"}"""
				.formatted(business.serviceId(), day, fromHour, day, toHour, name);
	}

	private static String change(LocalDate day, int fromHour, int toHour, String name) {
		return """
				{"startsAt":"%sT%02d:00","endsAt":"%sT%02d:00","customerName":"%s"}"""
				.formatted(day, fromHour, day, toHour, name);
	}

	private static String replacing(String body, String requestId) {
		return body.substring(0, body.length() - 1) + ",\"replacesRequestId\":\"" + requestId + "\"}";
	}

	/** The same body with one appointment in the way answered. */
	private static String answered(String body, String requestId, String action, String startsAt, String endsAt) {
		String times = startsAt == null ? "" : ",\"startsAt\":\"%s\",\"endsAt\":\"%s\"".formatted(startsAt, endsAt);
		return body.substring(0, body.length() - 1)
				+ ",\"resolutions\":[{\"requestId\":\"%s\",\"action\":\"%s\"%s}]}".formatted(requestId, action, times);
	}

	/** The instant a Denver wall-clock hour is, as the availability operation spells it. */
	private static String at(LocalDate day, int hour) {
		return day.atTime(hour, 0).atZone(DENVER).toInstant().toString();
	}

	private static String idOf(String body) {
		return JsonPath.read(body, "$.id");
	}

	private List<String> history(String requestId) {
		return jdbcTemplate.queryForList(
				"SELECT actor || ':' || to_status FROM job_request_event WHERE request_id = ?::uuid ORDER BY sequence_number",
				String.class, requestId);
	}

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

	private String send(Business business, String name) throws Exception {
		String body = mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"slug":"%s","serviceId":"%s","startsAt":"%s",
								 "customerName":"%s","customerEmail":"dana@example.com",
								 "description":"No hot water since Tuesday.",
								 "street1":"1 Main St","city":"Colorado Springs",
								 "state":"CO","postalCode":"80903"}"""
								.formatted(business.slug(), business.serviceId(), business.firstStart(), name)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		return JsonPath.read(body, "$.request.id");
	}

	private Business publish(String subject, String slug) throws Exception {
		RequestPostProcessor token = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);

		mockMvc.perform(BusinessFixtures.moveRequest(mockMvc, token, slug, COLORADO_SPRINGS))
				.andExpect(status().isOk());

		String created = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"tradeId":"%s","name":"Measured job",
								 "estimatedDurationMinutes":60,"pricingMode":"QUOTE_ONLY"}"""
								.formatted(BusinessFixtures.tradeId(mockMvc, "PLUMBER"))))
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
