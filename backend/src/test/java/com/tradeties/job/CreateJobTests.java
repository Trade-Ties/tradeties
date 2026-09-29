package com.tradeties.job;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.TestcontainersConfiguration;
import com.tradeties.job.JobFixtures.Booking;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sending the first request for a slot, without a token.
 *
 * <p>The start is never written down in these tests. It is read out of the availability operation
 * first, which is what a client does and what keeps the suite honest: a hard-coded instant would
 * pass against a calendar that offered nothing at all.
 *
 * <p>Every business here is published sixty-five miles from Denver for the reason the availability
 * suite gives — one shared database, and a plumber in Denver answers other suites' searches.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CreateJobTests {

	private static final ZoneId DENVER = JobFixtures.DENVER;

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbc;

	/**
	 * The rule the whole customer side rests on, asked of the first operation that writes.
	 *
	 * <p>The token comes back in the clear exactly once, which is checked here because it is the
	 * only place it ever exists in readable form.
	 */
	@Test
	void takesARequestWithoutATokenAndAnswersWithTheWayBack() throws Exception {
		Booking booking = bookable("user_job_open", "job-open", 60);

		mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(booking, booking.firstStart())))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.jobId").exists())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.accessTokenExpiresAt").exists())
				.andExpect(jsonPath("$.request.status").value("PENDING"))
				.andExpect(jsonPath("$.request.businessSlug").value("job-open"))
				.andExpect(jsonPath("$.request.timeZone").value("America/Denver"));
	}

	/**
	 * The snapshot is the substance of a request, so the answer has to carry what was frozen
	 * rather than leave the client to remember it.
	 *
	 * <p>The end is the interesting one: the client sent a start and nothing else, and an hour
	 * later is the service's own duration applied here. A client proposing its own end could
	 * propose one that does not match what it was quoted.
	 */
	@Test
	void freezesTheTermsItWasSentUnder() throws Exception {
		Booking booking = bookable("user_job_terms", "job-terms", 90);
		String start = booking.firstStart();

		mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(booking, start)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.request.serviceName").value("Measured job"))
				.andExpect(jsonPath("$.request.estimatedDurationMinutes").value(90))
				.andExpect(jsonPath("$.request.startsAt").exists())
				.andExpect(jsonPath("$.request.endsAt").exists())
				.andExpect(jsonPath("$.request.cancellationFee").exists())
				.andExpect(jsonPath("$.request.cancellationNoticeHours").exists());
	}

	/**
	 * A start nobody offered is refused before anything is written, and it is refused with a type
	 * of its own — the client's move is to re-read the calendar, not the service list.
	 *
	 * <p>Three in the morning is chosen because it is outside every working week the fixture can
	 * produce, so this asserts the check exists rather than that one particular grid excludes it.
	 */
	@Test
	void refusesAStartThatIsNotOnOffer() throws Exception {
		Booking booking = bookable("user_job_slot", "job-slot", 60);

		mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(booking, aMondaySoon().atStartOfDay(DENVER).plusHours(3)
								.toInstant().toString())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").value("urn:tradeties:problem:slot-not-offered"));
	}

	/**
	 * A service filed under another business is not a narrower search — it is a question about a
	 * pairing that does not exist, and it must not be answered by writing a request against the
	 * wrong duration and the wrong price.
	 */
	@Test
	void refusesAServiceThisBusinessDoesNotOffer() throws Exception {
		Booking mine = bookable("user_job_mine", "job-mine", 60);
		Booking theirs = bookable("user_job_theirs", "job-theirs", 60);

		mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(mine.slug(), theirs.serviceId(), mine.firstStart())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").value("urn:tradeties:problem:invalid-selection"));
	}

	/**
	 * A slug nobody holds is a page that does not exist, and a draft and a suspension are the same
	 * answer — telling them apart would publish a moderation decision to anybody who can type.
	 */
	@Test
	void refusesASlugNobodyHolds() throws Exception {
		Booking booking = bookable("user_job_gone", "job-gone", 60);

		mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body("no-such-business", booking.serviceId(), booking.firstStart())))
				.andExpect(status().isNotFound());
	}

	/**
	 * The customer has no account, so the confirmation email is the only place their way back is
	 * written down — and it has to be written while the request is, because the clear token exists
	 * nowhere after the response. Found by that token, which no other test's message can contain.
	 */
	@Test
	void queuesAConfirmationCarryingTheWayBack() throws Exception {
		Booking booking = bookable("user_job_mail", "job-mail", 60);

		String response = mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(booking, booking.firstStart())))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		String token = JsonPath.read(response, "$.accessToken");

		Map<String, Object> mail = jdbc.queryForMap(
				"SELECT recipient, subject, body, status FROM mail_outbox WHERE body LIKE ?", "%" + token + "%");

		assertThat(mail.get("recipient")).isEqualTo("dana@example.com");
		assertThat(mail.get("status")).isEqualTo("PENDING");
		assertThat((String) mail.get("subject")).startsWith("Your request to ").endsWith(" has been sent");
		assertThat((String) mail.get("body"))
				.startsWith("Hi Dana,")
				.contains("Measured job")
				.contains("No hot water since Tuesday.")
				.contains("1 Main St, Apt 4, Colorado Springs, CO 80903")
				// Read on the business's clock and saying so.
				.containsPattern("\\(M[SD]T\\)")
				// The address the booking form shows too: one place, whichever way they come back.
				.contains("http://localhost:3000/job-mail/requests/" + token);
	}

	/**
	 * A refused request writes nothing, and that includes its email: the confirmation commits with
	 * the request or not at all, so nobody is told a request arrived that was never kept.
	 */
	@Test
	void queuesNothingForARefusedRequest() throws Exception {
		Booking booking = bookable("user_job_nomail", "job-nomail", 60);
		int before = jdbc.queryForObject("SELECT count(*) FROM mail_outbox", Integer.class);

		mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(booking, aMondaySoon().atStartOfDay(DENVER).plusHours(3)
								.toInstant().toString())))
				.andExpect(status().isBadRequest());

		assertThat(jdbc.queryForObject("SELECT count(*) FROM mail_outbox", Integer.class)).isEqualTo(before);
	}

	/**
	 * The way back, used: the token from the answer opens the job again, with the request and the
	 * terms it was sent under, and the business as it is called now.
	 */
	@Test
	void readsTheJobBackWithItsToken() throws Exception {
		Booking booking = bookable("user_job_back", "job-back", 60);
		String token = JsonPath.read(place(booking), "$.accessToken");

		mockMvc.perform(get("/api/v1/jobs/by-token").header("X-Job-Token", token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.customerName").value("Dana Reyes"))
				.andExpect(jsonPath("$.customerEmail").value("dana@example.com"))
				.andExpect(jsonPath("$.description").value("No hot water since Tuesday."))
				.andExpect(jsonPath("$.address.city").value("Colorado Springs"))
				.andExpect(jsonPath("$.requests.length()").value(1))
				.andExpect(jsonPath("$.requests[0].request.status").value("PENDING"))
				.andExpect(jsonPath("$.requests[0].request.businessSlug").value("job-back"))
				.andExpect(jsonPath("$.requests[0].request.serviceName").value("Measured job"))
				.andExpect(jsonPath("$.requests[0].request.timeZone").value("America/Denver"))
				// The credential is read, never repeated back.
				.andExpect(jsonPath("$.accessToken").doesNotExist());
	}

	/** A value nobody was ever given opens nothing. */
	@Test
	void findsNothingForATokenNeverIssued() throws Exception {
		mockMvc.perform(get("/api/v1/jobs/by-token").header("X-Job-Token", "not-a-token-anybody-was-given"))
				.andExpect(status().isNotFound());
	}

	/**
	 * An expired token is answered exactly as one that never existed. Telling them apart would
	 * confirm that a guessed value had once been real.
	 */
	@Test
	void findsNothingForAnExpiredToken() throws Exception {
		Booking booking = bookable("user_job_expired", "job-expired", 60);
		String placed = place(booking);
		String token = JsonPath.read(placed, "$.accessToken");

		jdbc.update("UPDATE job SET access_token_expires_at = now() - interval '1 minute' WHERE id = ?::uuid",
				(String) JsonPath.read(placed, "$.jobId"));

		mockMvc.perform(get("/api/v1/jobs/by-token").header("X-Job-Token", token))
				.andExpect(status().isNotFound());
	}

	/** Without the header there is no question to answer; the contract refuses it first. */
	@Test
	void refusesToLookUpWithoutAToken() throws Exception {
		mockMvc.perform(get("/api/v1/jobs/by-token"))
				.andExpect(status().isBadRequest());
	}

	/** A body the contract itself refuses never reaches the service. */
	@Test
	void refusesABodyWithoutTheCustomer() throws Exception {
		Booking booking = bookable("user_job_blank", "job-blank", 60);

		mockMvc.perform(post("/api/v1/jobs")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"slug":"%s","serviceId":"%s","startsAt":"%s",
								 "description":"No hot water","street1":"1 Main St",
								 "city":"Colorado Springs","state":"CO","postalCode":"80903"}"""
								.formatted(booking.slug(), booking.serviceId(), booking.firstStart())))
				.andExpect(status().isBadRequest());
	}

	private String place(Booking booking) throws Exception {
		return JobFixtures.place(mockMvc, booking);
	}

	private String body(Booking booking, String startsAt) {
		return JobFixtures.body(booking.slug(), booking.serviceId(), startsAt);
	}

	private String body(String slug, String serviceId, String startsAt) {
		return JobFixtures.body(slug, serviceId, startsAt);
	}

	private Booking bookable(String subject, String slug, int minutes) throws Exception {
		return JobFixtures.bookable(mockMvc, subject, slug, minutes);
	}

	private static LocalDate aMondaySoon() {
		return JobFixtures.aMondaySoon();
	}
}
