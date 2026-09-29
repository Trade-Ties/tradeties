package com.tradeties.availability;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
 * Time off and blocked hours, against the real slot walk and the real requests they land on.
 *
 * <p>Requests are sent through the public endpoint rather than inserted, for the reason
 * {@code InboxTests} gives: the dialog decides on what the customer actually sent.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TimeOffTests {

	private static final ZoneId DENVER = ZoneId.of("America/Denver");
	private static final String COLORADO_SPRINGS = "80903";
	private static final String CONFLICTS = "urn:tradeties:problem:time-off-conflicts";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	void refusesToShowTimeOffWithoutAToken() throws Exception {
		mockMvc.perform(get("/api/v1/me/business/time-off")).andExpect(status().isUnauthorized());
	}

	/** Days in, days out: the entry comes back in the shape it was sent, on the business's clock. */
	@Test
	void storesWholeDaysAndReadsThemBack() throws Exception {
		Business acme = publish("user_off_days", "off-days");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(adding(acme, allDay(monday, monday.plusDays(4), "Family vacation")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.allDay").value(true))
				.andExpect(jsonPath("$.firstDay").value(monday.toString()))
				.andExpect(jsonPath("$.lastDay").value(monday.plusDays(4).toString()))
				.andExpect(jsonPath("$.timeZone").value("America/Denver"))
				.andExpect(jsonPath("$.startsAt").doesNotExist());

		mockMvc.perform(get("/api/v1/me/business/time-off").with(acme.token()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].note").value("Family vacation"));
	}

	@Test
	void storesAStretchOfHours() throws Exception {
		Business acme = publish("user_off_hours", "off-hours");
		LocalDate tuesday = aMondaySoon().plusDays(1);

		mockMvc.perform(adding(acme, hours(tuesday + "T13:00", tuesday + "T15:30", "Dentist")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.allDay").value(false))
				.andExpect(jsonPath("$.startsAt").value(tuesday + "T13:00"))
				.andExpect(jsonPath("$.endsAt").value(tuesday + "T15:30"))
				.andExpect(jsonPath("$.firstDay").doesNotExist());
	}

	/** Asked of the same walk a customer asks, so a subtraction it forgot would fail here. */
	@Test
	void takesTheHoursOffTheCalendar() throws Exception {
		Business acme = publish("user_off_takes", "off-takes");
		LocalDate monday = aMondaySoon();
		assertTrue(stillOffers(acme, acme.firstStart()), "the hour is on offer before the time off");

		mockMvc.perform(adding(acme, allDay(monday, monday, null))).andExpect(status().isCreated());

		assertFalse(stillOffers(acme, acme.firstStart()), "and gone once the day is taken off");
	}

	/** Nobody is turned away unseen: the first attempt names every request in the way. */
	@Test
	void namesThePendingRequestsInTheWay() throws Exception {
		Business acme = publish("user_off_ask", "off-ask");
		String requestId = send(acme, "Dana Reyes");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(adding(acme, allDay(monday, monday, "Training")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.type").value(CONFLICTS))
				.andExpect(jsonPath("$.conflicts.length()").value(1))
				.andExpect(jsonPath("$.conflicts[0].requestId").value(requestId))
				.andExpect(jsonPath("$.conflicts[0].status").value("PENDING"))
				.andExpect(jsonPath("$.conflicts[0].customerName").value("Dana Reyes"));

		mockMvc.perform(get("/api/v1/me/business/time-off").with(acme.token()))
				.andExpect(jsonPath("$.length()").value(0));
	}

	/**
	 * The decline carries the message written for the customer, never the private note, and the
	 * history says the business decided it.
	 */
	@Test
	void declinesTheRequestsItIsToldTo() throws Exception {
		Business acme = publish("user_off_decline", "off-decline");
		String requestId = send(acme, "Dana Reyes");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(adding(acme, answered(allDay(monday, monday, "Knee surgery"),
						requestId, "DECLINE", "I'm away that day — happy to find another.")))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token()))
				.andExpect(jsonPath("$[0].status").value("DECLINED"))
				.andExpect(jsonPath("$[0].declineReason").value("I'm away that day — happy to find another."));

		List<String> history = jdbcTemplate.queryForList(
				"SELECT actor || ':' || to_status FROM job_request_event WHERE request_id = ?::uuid ORDER BY sequence_number",
				String.class, requestId);
		assertEquals(List.of("CUSTOMER:PENDING", "BUSINESS:DECLINED"), history);
	}

	@Test
	void refusesADeclineWithoutAMessageForTheCustomer() throws Exception {
		Business acme = publish("user_off_silent", "off-silent");
		String requestId = send(acme, "Dana Reyes");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(adding(acme, answered(allDay(monday, monday, null), requestId, "DECLINE", null)))
				.andExpect(status().isBadRequest());
	}

	/** Left open means "I will answer later", not "I can accept it later regardless". */
	@Test
	void leavesOpenWhatItIsToldToButWillNotLetItBeAccepted() throws Exception {
		Business acme = publish("user_off_open", "off-open");
		String requestId = send(acme, "Dana Reyes");
		LocalDate monday = aMondaySoon();

		mockMvc.perform(adding(acme, answered(allDay(monday, monday, null), requestId, "KEEP", null)))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/accept", requestId).with(acme.token()))
				.andExpect(status().isConflict());
	}

	/**
	 * An accepted appointment is kept and stays booked — a cancellation is not offered from here —
	 * and that somebody confirmed over it is written down.
	 */
	@Test
	void keepsAcceptedAppointmentsAndRecordsTheOverride() throws Exception {
		Business acme = publish("user_off_keep", "off-keep");
		String requestId = send(acme, "Dana Reyes");
		mockMvc.perform(post("/api/v1/me/business/job-requests/{id}/accept", requestId).with(acme.token()))
				.andExpect(status().isOk());
		LocalDate monday = aMondaySoon();

		mockMvc.perform(adding(acme, allDay(monday, monday, null)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.conflicts[0].status").value("ACCEPTED"));

		mockMvc.perform(adding(acme, answered(allDay(monday, monday, null), requestId, "DECLINE", "Sorry.")))
				.andExpect(status().isConflict());

		String stored = mockMvc.perform(adding(acme, answered(allDay(monday, monday, null), requestId, "KEEP", null)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(get("/api/v1/me/business/job-requests").with(acme.token()))
				.andExpect(jsonPath("$[0].status").value("ACCEPTED"));

		assertNotNull(jdbcTemplate.queryForObject(
				"SELECT conflict_override_confirmed_at FROM availability_time_off WHERE id = ?::uuid",
				java.sql.Timestamp.class, (String) JsonPath.read(stored, "$.id")));
	}

	/** What the entry already covered was answered when it was made; only new ground is asked about. */
	@Test
	void anEditOnlyAsksAboutWhatItNewlyCovers() throws Exception {
		Business acme = publish("user_off_edit", "off-edit");
		LocalDate monday = aMondaySoon();
		String stored = mockMvc.perform(adding(acme, allDay(monday.plusDays(1), monday.plusDays(1), null)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String id = JsonPath.read(stored, "$.id");
		String requestId = send(acme, "Dana Reyes");

		mockMvc.perform(replacing(acme, id, 0, allDay(monday, monday.plusDays(1), null)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.conflicts[0].requestId").value(requestId));

		String moved = mockMvc.perform(replacing(acme, id, 0,
						answered(allDay(monday, monday.plusDays(1), null), requestId, "KEEP", null)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.firstDay").value(monday.toString()))
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(replacing(acme, id, JsonPath.<Integer>read(moved, "$.version"),
						allDay(monday, monday.plusDays(1), "Moved the course")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.note").value("Moved the course"));
	}

	@Test
	void aStaleVersionIsRefused() throws Exception {
		Business acme = publish("user_off_stale", "off-stale");
		LocalDate monday = aMondaySoon();
		String stored = mockMvc.perform(adding(acme, allDay(monday, monday, null)))
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(replacing(acme, JsonPath.read(stored, "$.id"), 7, allDay(monday, monday, "x")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.conflicts").doesNotExist());
	}

	@Test
	void removingGivesTheHoursBack() throws Exception {
		Business acme = publish("user_off_remove", "off-remove");
		LocalDate monday = aMondaySoon();
		String stored = mockMvc.perform(adding(acme, allDay(monday, monday, null)))
				.andReturn().getResponse().getContentAsString();
		String id = JsonPath.read(stored, "$.id");

		mockMvc.perform(delete("/api/v1/me/business/time-off/{id}", id).with(acme.token()))
				.andExpect(status().isNoContent());

		assertTrue(stillOffers(acme, acme.firstStart()), "the hour is on offer again");
		mockMvc.perform(delete("/api/v1/me/business/time-off/{id}", id).with(acme.token()))
				.andExpect(status().isNotFound());
	}

	@Test
	void refusesTimeThatIsAlreadyOver() throws Exception {
		Business acme = publish("user_off_past", "off-past");
		LocalDate lastWeek = LocalDate.now(DENVER).minusWeeks(1);

		mockMvc.perform(adding(acme, allDay(lastWeek, lastWeek, null))).andExpect(status().isBadRequest());
	}

	@Test
	void refusesAnEndBeforeTheStart() throws Exception {
		Business acme = publish("user_off_backwards", "off-backwards");
		LocalDate tuesday = aMondaySoon().plusDays(1);

		mockMvc.perform(adding(acme, hours(tuesday + "T15:00", tuesday + "T13:00", null)))
				.andExpect(status().isBadRequest());
	}

	/** Somebody else's entry is not found rather than forbidden, like every owner endpoint. */
	@Test
	void willNotTouchAnotherBusinesssEntry() throws Exception {
		Business acme = publish("user_off_mine", "off-mine");
		Business other = publish("user_off_theirs", "off-theirs");
		LocalDate monday = aMondaySoon();
		String stored = mockMvc.perform(adding(acme, allDay(monday, monday, null)))
				.andReturn().getResponse().getContentAsString();
		String id = JsonPath.read(stored, "$.id");

		mockMvc.perform(delete("/api/v1/me/business/time-off/{id}", id).with(other.token()))
				.andExpect(status().isNotFound());
		mockMvc.perform(replacing(other, id, 0, allDay(monday, monday, null)))
				.andExpect(status().isNotFound());
	}

	private RequestBuilder adding(Business business, String body) {
		return post("/api/v1/me/business/time-off").with(business.token())
				.contentType(MediaType.APPLICATION_JSON)
				.content(body);
	}

	private RequestBuilder replacing(Business business, String id, int version, String body) {
		return put("/api/v1/me/business/time-off/{id}", id).with(business.token())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"version\":" + version + "," + body.substring(1));
	}

	private static String allDay(LocalDate first, LocalDate last, String note) {
		return """
				{"allDay":true,"firstDay":"%s","lastDay":"%s"%s}"""
				.formatted(first, last, note == null ? "" : ",\"note\":\"" + note + "\"");
	}

	private static String hours(String startsAt, String endsAt, String note) {
		return """
				{"allDay":false,"startsAt":"%s","endsAt":"%s"%s}"""
				.formatted(startsAt, endsAt, note == null ? "" : ",\"note\":\"" + note + "\"");
	}

	/** The same body with one request answered, and the message for the customer if there is one. */
	private static String answered(String body, String requestId, String action, String declineReason) {
		return body.substring(0, body.length() - 1)
				+ ",\"resolutions\":[{\"requestId\":\"%s\",\"action\":\"%s\"}]".formatted(requestId, action)
				+ (declineReason == null ? "" : ",\"declineReason\":\"" + declineReason + "\"")
				+ "}";
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
