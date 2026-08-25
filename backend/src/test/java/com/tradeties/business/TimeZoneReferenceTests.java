package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.ZoneId;
import java.util.List;

import com.tradeties.TestcontainersConfiguration;

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
 * The time zone is the axis the whole calendar turns on.
 *
 * <p>Working hours are stored as local wall clock, and this one column is what turns them into
 * instants. A value that cannot be resolved does not fail where it is entered — it fails months
 * later, in the slot calculation, for one business, in a completely different endpoint. Which
 * is why it is checked at the door.
 *
 * <p>The contract cannot do that checking: there is no pattern separating
 * {@code America/Denver} from {@code Europe/Zurich123}. A table and a foreign key can, and they
 * double as the list the wizard's select needs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TimeZoneReferenceTests {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/**
	 * The tripwire. Every seeded id has to be one the JVM can resolve, or the column would hold
	 * a value that passes the foreign key and still breaks {@code ZoneId.of} downstream — the
	 * exact failure the table exists to prevent, only harder to find because the database would
	 * be vouching for it.
	 *
	 * <p>Guards against a tzdata change on either side: a zone retired from the JDK, or a typo
	 * in the migration that nobody would otherwise notice until a business picked that entry.
	 */
	@Test
	void everySeededZoneResolvesInTheJvm() {
		List<String> codes = jdbcTemplate.queryForList(
				"SELECT code FROM time_zone ORDER BY sort_order", String.class);

		assertEquals(6, codes.size(), "the six zones the marketplace serves");

		for (String code : codes) {
			assertDoesNotThrow(() -> ZoneId.of(code), "seeded zone " + code + " is not resolvable");
		}
	}

	/** Public like the other two catalogues: the wizard needs it, and a zone id names nobody. */
	@Test
	void theListIsServedWithoutAToken() throws Exception {
		mockMvc.perform(get("/api/v1/time-zones"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(6))
				// Ordered east to west, not alphabetical — alphabetical would open with Alaska.
				.andExpect(jsonPath("$[0].code").value("America/New_York"))
				.andExpect(jsonPath("$[0].displayName").value("Eastern Time"))
				.andExpect(jsonPath("$[5].code").value("Pacific/Honolulu"));
	}

	@Test
	void aBusinessCanBeCreatedWithASeededZone() throws Exception {
		mockMvc.perform(createBusiness("user_zone_ok", "zone-ok", "Pacific/Honolulu"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.timeZone").value("Pacific/Honolulu"));
	}

	/**
	 * The detail matters as much as the status: without the check in {@code BusinessService}
	 * the foreign key fires instead, is caught as a lost slug race, and the tradesperson is told
	 * their URL is taken — about a field they did not touch.
	 */
	@Test
	void anUnknownZoneIsRejectedAndSaysSo() throws Exception {
		mockMvc.perform(createBusiness("user_zone_bad", "zone-bad", "Europe/Zurich123"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value("No such time zone: Europe/Zurich123"));
	}

	/**
	 * A fixed offset parses through {@code ZoneId.of} and is still wrong here: it knows nothing
	 * about daylight saving, so "Mondays from 8" would drift by an hour twice a year. Checking
	 * against the table rather than against {@code ZoneId} is what catches it.
	 */
	@Test
	void aFixedOffsetIsRejectedAlthoughJavaWouldParseIt() throws Exception {
		assertDoesNotThrow(() -> ZoneId.of("+02:00"), "precondition: Java accepts this");

		mockMvc.perform(createBusiness("user_zone_offset", "zone-offset", "+02:00"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void anUnknownZoneIsRejectedOnUpdateToo() throws Exception {
		RequestPostProcessor token = jwt().jwt(t -> t.subject("user_zone_update")
				.claim("email", "user_zone_update@example.com"));

		mockMvc.perform(post("/api/v1/me/registration").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"intent":"TRADESPERSON"}"""))
				.andExpect(status().isOk());

		mockMvc.perform(createBusiness(token, "zone-update", "America/Denver"))
				.andExpect(status().isCreated());

		mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(businessJson("zone-update", "Mitteleuropaeisch", "\"version\": 0,")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value("No such time zone: Mitteleuropaeisch"));
	}

	private org.springframework.test.web.servlet.RequestBuilder createBusiness(
			String subject, String slug, String timeZone) throws Exception {

		RequestPostProcessor token = jwt().jwt(t -> t.subject(subject).claim("email", subject + "@example.com"));

		mockMvc.perform(post("/api/v1/me/registration").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"intent":"TRADESPERSON"}"""))
				.andExpect(status().isOk());

		return createBusiness(token, slug, timeZone);
	}

	private org.springframework.test.web.servlet.RequestBuilder createBusiness(
			RequestPostProcessor token, String slug, String timeZone) {

		return post("/api/v1/me/business").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(businessJson(slug, timeZone, ""));
	}

	private static String businessJson(String slug, String timeZone, String extra) {
		return """
				{
				  %s
				  "slug": "%s",
				  "legalName": "Acme Plumbing LLC",
				  "displayName": "Acme Plumbing",
				  "phone": "+13035550101",
				  "email": "dispatch@acme.example",
				  "address": {
				    "street1": "123 Main St",
				    "city": "Denver",
				    "state": "CO",
				    "postalCode": "80202"
				  },
				  "timeZone": "%s",
				  "serviceRadiusMiles": 25
				}""".formatted(extra, slug, timeZone);
	}
}
