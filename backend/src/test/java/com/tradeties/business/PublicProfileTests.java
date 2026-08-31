package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.UUID;

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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * One business read by its public address, without a token and without an account.
 *
 * <p>Two of these tests are the ones to keep. {@link #nothingInTheAnswerIdentifiesAPerson} is the
 * anonymity rule as an assertion rather than as a paragraph — it fails the moment a field is
 * added to the public mapping without that being a decision. And
 * {@link #everyServiceCarriesTheLengthAnAppointmentWillHave} is the reason this operation exists
 * at all: a slot has no length until a service is chosen, so the calendar cannot be drawn before
 * this answer is in hand.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PublicProfileTests {

	private static final String INSERT_LICENCE = """
			INSERT INTO business_license (id, business_id, state, license_number, expires_on,
				created_at, updated_at, version)
			VALUES (?, (SELECT id FROM business_profile WHERE slug = ?), 'CO', ?, ?, now(), now(), 0)""";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/** The rule the whole customer side rests on: no account, no token, no sign-in. */
	@Test
	void theProfileAnswersWithoutAToken() throws Exception {
		publish("user_pub_open", "pub-open");

		mockMvc.perform(get("/api/v1/businesses/pub-open"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slug").value("pub-open"))
				.andExpect(jsonPath("$.city").value("Denver"))
				.andExpect(jsonPath("$.timeZone").value("America/Denver"));
	}

	/**
	 * The whole of DECISIONS section 1's anonymity rule, stated as absences.
	 *
	 * <p>Each of these is a field the owner's own view carries and this one must not: a trade
	 * address is often somebody's home, a dispatch line printed here would route around the
	 * appointment the page exists to arrange, and a legal name is the company's paperwork rather
	 * than the customer's business.
	 *
	 * <p>Asserted as {@code doesNotExist} rather than as null, because that is the difference
	 * between a field left empty and a field that was never in the answer's shape.
	 */
	@Test
	void nothingInTheAnswerIdentifiesAPerson() throws Exception {
		publish("user_pub_anon", "pub-anon");

		mockMvc.perform(get("/api/v1/businesses/pub-anon"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.legalName").doesNotExist())
				.andExpect(jsonPath("$.phone").doesNotExist())
				.andExpect(jsonPath("$.email").doesNotExist())
				.andExpect(jsonPath("$.address").doesNotExist())
				.andExpect(jsonPath("$.coordinates").doesNotExist())
				.andExpect(jsonPath("$.status").doesNotExist())
				.andExpect(jsonPath("$.version").doesNotExist());
	}

	/** A draft is nobody's to find, and nobody's to open by typing its address either. */
	@Test
	void aDraftIsNotThere() throws Exception {
		BusinessFixtures.publishableBusinessFor(mockMvc, "user_pub_draft", "pub-draft");

		mockMvc.perform(get("/api/v1/businesses/pub-draft"))
				.andExpect(status().isNotFound());
	}

	/**
	 * A suspension reads exactly like a slug nobody holds, and that is the point. Anything that
	 * told them apart would publish a moderation decision to whoever cared to check.
	 */
	@Test
	void aSuspendedProfileIsNotThere() throws Exception {
		publish("user_pub_susp", "pub-susp");
		jdbcTemplate.update("UPDATE business_profile SET status = 'SUSPENDED' WHERE slug = 'pub-susp'");

		mockMvc.perform(get("/api/v1/businesses/pub-susp"))
				.andExpect(status().isNotFound());

		mockMvc.perform(get("/api/v1/businesses/nobody-holds-this"))
				.andExpect(status().isNotFound());
	}

	/**
	 * Why the customer reads this page before any calendar: the duration is what gives an
	 * appointment a length, and it lives on the service rather than on the business.
	 *
	 * <p>The three absences are the editing fields. A version to write back with, a position to
	 * move it by and an active flag are all about maintaining a list nobody out here can change —
	 * and every service in this answer is active, because the inactive ones were never fetched.
	 */
	@Test
	void everyServiceCarriesTheLengthAnAppointmentWillHave() throws Exception {
		publish("user_pub_svc", "pub-svc");

		mockMvc.perform(get("/api/v1/businesses/pub-svc"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.services.length()").value(1))
				.andExpect(jsonPath("$.services[0].name").value("Clog removal"))
				.andExpect(jsonPath("$.services[0].estimatedDurationMinutes").value(60))
				.andExpect(jsonPath("$.services[0].active").doesNotExist())
				.andExpect(jsonPath("$.services[0].sortOrder").doesNotExist())
				.andExpect(jsonPath("$.services[0].version").doesNotExist());
	}

	/** A service the business stopped offering is off the menu, whatever it still is in history. */
	@Test
	void aServiceNoLongerOfferedIsNotOnTheMenu() throws Exception {
		publish("user_pub_off", "pub-off");
		jdbcTemplate.update("""
				UPDATE business_service SET active = false
				WHERE business_id = (SELECT id FROM business_profile WHERE slug = 'pub-off')""");

		mockMvc.perform(get("/api/v1/businesses/pub-off"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.services").isEmpty());
	}

	/**
	 * The cancellation fee, readable before anything is sent — which is the only moment it can do
	 * its job. It is snapshotted onto a request when the request is made, so what was displayed is
	 * what binds, and a customer asking three businesses at once is being told in dollars what a
	 * double booking would cost.
	 */
	@Test
	void theTermsAreReadableBeforeAnyRequestIsSent() throws Exception {
		publish("user_pub_terms", "pub-terms");

		mockMvc.perform(get("/api/v1/businesses/pub-terms"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pricing.cancellationFee").value("50.0000"))
				.andExpect(jsonPath("$.pricing.cancellationNoticeHours").value(24))
				.andExpect(jsonPath("$.pricing.version").doesNotExist());
	}

	/**
	 * A licence says what is on file and no more. Nothing has been verified in this marketplace
	 * yet, so the flag is false — and it is a flag rather than a date, because when TradeTies
	 * looked is the marketplace's own record.
	 */
	@Test
	void aLicenceIsShownWithoutClaimingItWasChecked() throws Exception {
		RequestPostProcessor token = publish("user_pub_lic", "pub-lic");

		mockMvc.perform(post("/api/v1/me/business/licenses").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"state":"CO","licenseNumber":"PL-77","licenseType":"Master Plumber"}"""))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/businesses/pub-lic"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.licenses.length()").value(1))
				.andExpect(jsonPath("$.licenses[0].licenseNumber").value("PL-77"))
				.andExpect(jsonPath("$.licenses[0].verified").value(false))
				.andExpect(jsonPath("$.licenses[0].id").doesNotExist());
	}

	/**
	 * An expired licence is not a weaker claim than a current one — it is not a claim. Shown, it
	 * would read as a badge, which is the one thing this data cannot support.
	 */
	@Test
	void anExpiredLicenceIsNotShownAtAll() throws Exception {
		publish("user_pub_expired", "pub-expired");
		jdbcTemplate.update(INSERT_LICENCE, UUID.randomUUID(), "pub-expired", "PL-OLD",
				java.sql.Date.valueOf(LocalDate.now().minusDays(1)));

		mockMvc.perform(get("/api/v1/businesses/pub-expired"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.licenses").isEmpty());
	}

	/**
	 * Which trade the business leads with, said by an id rather than by a position in the list.
	 * A client that reads "the first one" would be relying on an order nothing promises.
	 */
	@Test
	void theProfileNamesTheTradeItLeadsWith() throws Exception {
		publish("user_pub_trade", "pub-trade");

		String plumber = BusinessFixtures.tradeId(mockMvc, "PLUMBER");

		mockMvc.perform(get("/api/v1/businesses/pub-trade"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.primaryTradeId").value(plumber))
				.andExpect(jsonPath("$.trades[*].id", Matchers.hasItem(plumber)))
				.andExpect(jsonPath("$.services[0].tradeId").value(plumber));
	}

	private RequestPostProcessor publish(String subject, String slug) throws Exception {
		RequestPostProcessor token = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		return token;
	}
}
