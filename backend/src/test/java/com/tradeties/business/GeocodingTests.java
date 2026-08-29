package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The address becoming a point, which is what puts a business into a radius search at all.
 *
 * <p>Nothing here asserts accuracy — a ZIP centroid is the middle of a postal area and is not
 * trying to be the front door. What is asserted is that the point exists, that it follows the
 * address, and that it is recorded together with how it was found.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class GeocodingTests {

	/** Denver, and Boulder 25 miles up the road — far enough apart that a stale point shows. */
	private static final String DENVER = "80202";
	private static final double DENVER_LATITUDE = 39.751526;
	private static final String BOULDER = "80301";
	private static final double BOULDER_LATITUDE = 40.04569;

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	void aNewProfileIsPlacedAtTheCentroidOfItsZip() throws Exception {
		createBusiness("user_geo_create", "geo-create", DENVER)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.coordinates.latitude").value(DENVER_LATITUDE))
				.andExpect(jsonPath("$.coordinates.longitude").value(-104.997673));

		assertEquals("ZIP", precisionOf("geo-create"), "how the point was found, recorded with it");
	}

	/**
	 * The point follows the address. Without this the profile keeps the coordinates it was
	 * created with: it drops out of the searches it now belongs in and stays in the ones it has
	 * left, and nothing on the profile looks wrong while it happens.
	 */
	@Test
	void movingTheBusinessMovesThePoint() throws Exception {
		RequestPostProcessor token = registerAndCreate("user_geo_move", "geo-move", DENVER);

		update(token, "geo-move", BOULDER, "null")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.coordinates.latitude").value(BOULDER_LATITUDE));
	}

	/**
	 * The same move, with the body the wizard actually sends.
	 *
	 * <p>{@code toWire.ts} echoes the stored coordinates back on every save of steps 1 and 2 — it
	 * was written when nothing geocoded, to stop a full replacement wiping the field. A server
	 * that treated that echo as the client's override would freeze the first geocode forever, and
	 * this is the test that says it does not.
	 */
	@Test
	void theEchoedCoordinatesDoNotFreezeTheGeocode() throws Exception {
		RequestPostProcessor token = registerAndCreate("user_geo_echo", "geo-echo", DENVER);

		String stale = """
				{"latitude": %s, "longitude": -104.997673}""".formatted(DENVER_LATITUDE);

		update(token, "geo-echo", BOULDER, stale)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.coordinates.latitude").value(BOULDER_LATITUDE));
	}

	/** The contract accepts both spellings of one postal code; the table is keyed on five digits. */
	@Test
	void aZipPlusFourResolvesOnItsFirstFiveDigits() throws Exception {
		createBusiness("user_geo_plusfour", "geo-plusfour", DENVER + "-1234")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.coordinates.latitude").value(DENVER_LATITUDE));
	}

	/**
	 * A ZIP the Census does not list — PO-box-only codes have no ZCTA — is stored without a point
	 * rather than refused. Onboarding must not dead-end on it; the readiness check is where an
	 * unfindable profile is stopped, at the door it would go live through.
	 */
	@Test
	void aZipWithNoCentroidIsStoredWithoutAPoint() throws Exception {
		createBusiness("user_geo_unknown", "geo-unknown", "00000")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.coordinates").doesNotExist());

		assertEquals(null, precisionOf("geo-unknown"), "no point, nothing to say about its precision");
	}

	/**
	 * The pairing, from the database's side. Coordinates and precision are written together by one
	 * method today; the constraint is what keeps that true for the next writer — an import, an
	 * admin fix-up, a migration.
	 */
	@Test
	void aPointWithoutItsPrecisionIsRefused() throws Exception {
		registerAndCreate("user_geo_pairing", "geo-pairing", DENVER);

		assertThrows(DataIntegrityViolationException.class,
				() -> jdbcTemplate.update(
						"UPDATE business_profile SET geocode_precision = NULL WHERE slug = 'geo-pairing'"));
	}

	private String precisionOf(String slug) {
		return jdbcTemplate.queryForObject(
				"SELECT geocode_precision FROM business_profile WHERE slug = ?", String.class, slug);
	}

	private RequestPostProcessor registerAndCreate(String subject, String slug, String postalCode)
			throws Exception {

		RequestPostProcessor token = register(subject);
		mockMvc.perform(createRequest(token, slug, postalCode)).andExpect(status().isCreated());
		return token;
	}

	private org.springframework.test.web.servlet.ResultActions createBusiness(
			String subject, String slug, String postalCode) throws Exception {

		return mockMvc.perform(createRequest(register(subject), slug, postalCode));
	}

	private RequestPostProcessor register(String subject) throws Exception {
		RequestPostProcessor token = jwt().jwt(t -> t.subject(subject).claim("email", subject + "@example.com"));

		mockMvc.perform(post("/api/v1/me/registration").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"intent":"TRADESPERSON"}"""))
				.andExpect(status().isOk());

		return token;
	}

	private org.springframework.test.web.servlet.RequestBuilder createRequest(
			RequestPostProcessor token, String slug, String postalCode) {

		return post("/api/v1/me/business").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(businessJson(slug, postalCode, ""));
	}

	private org.springframework.test.web.servlet.ResultActions update(
			RequestPostProcessor token, String slug, String postalCode, String coordinates) throws Exception {

		return mockMvc.perform(put("/api/v1/me/business").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(businessJson(slug, postalCode,
						"\"version\": 0, \"coordinates\": " + coordinates + ",")));
	}

	private static String businessJson(String slug, String postalCode, String extra) {
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
				    "postalCode": "%s"
				  },
				  "timeZone": "America/Denver",
				  "serviceRadiusMiles": 25
				}""".formatted(extra, slug, postalCode);
	}
}
