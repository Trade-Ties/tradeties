package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;

import javax.sql.DataSource;

import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The one-off that catches up the profiles saved before anything geocoded.
 *
 * <p>Flyway has already run it by the time any test starts, and against an empty schema it had
 * nothing to do — so each test here stages the row the migration exists for and replays the
 * statement. Replayed <em>from the migration file</em>, not from a copy of it pasted in: a copy
 * would keep passing after somebody edited the real one.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class GeocodeBackfillTests {

	private static final String MIGRATION = "db/migration/V12__geocode_existing_profiles.sql";

	private static final BigDecimal DENVER_LATITUDE = new BigDecimal("39.751526");
	private static final BigDecimal BOULDER_LATITUDE = new BigDecimal("40.045690");

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Autowired
	DataSource dataSource;

	@Test
	void aProfileLeftWithoutAPointIsGivenOne() throws Exception {
		storedBeforeGeocoding("user_backfill_plain", "backfill-plain", "80202");

		replayTheMigration();

		assertEquals(0, DENVER_LATITUDE.compareTo(latitudeOf("backfill-plain")));
		assertEquals("ZIP", precisionOf("backfill-plain"));
	}

	/**
	 * The trap the migration is written around. {@code zip_centroid} is keyed on five digits and
	 * the column holds ZIP or ZIP+4, so a join on the whole column matches nothing for everyone
	 * who typed the longer form — and leaves exactly those profiles unfindable.
	 */
	@Test
	void aZipPlusFourProfileIsNotSkipped() throws Exception {
		storedBeforeGeocoding("user_backfill_plusfour", "backfill-plusfour", "80202-1234");

		replayTheMigration();

		assertEquals(0, DENVER_LATITUDE.compareTo(latitudeOf("backfill-plusfour")));
	}

	/**
	 * The migration only ever adds. A profile that has been written since — or that a later,
	 * sharper geocode has moved — must come out the other side untouched.
	 */
	@Test
	void aProfileThatAlreadyHasAPointIsLeftAlone() throws Exception {
		RequestPostProcessor token = register("user_backfill_kept");
		create(token, "backfill-kept", "80202");

		// The same profile as if something more precise had already placed it up the road.
		jdbcTemplate.update("""
				UPDATE business_profile SET latitude = ?, longitude = -105.200890
				WHERE slug = 'backfill-kept'
				""", BOULDER_LATITUDE);

		replayTheMigration();

		assertEquals(0, BOULDER_LATITUDE.compareTo(latitudeOf("backfill-kept")),
				"the ZIP centroid must not overwrite a point that is already there");
	}

	/** A ZIP with no centroid stays without a point, and does not fail the migration for everyone else. */
	@Test
	void aProfileWithAnUnlistedZipStaysWithoutAPoint() throws Exception {
		storedBeforeGeocoding("user_backfill_unlisted", "backfill-unlisted", "00000");

		replayTheMigration();

		assertNull(latitudeOf("backfill-unlisted"));
		assertNull(precisionOf("backfill-unlisted"));
	}

	/**
	 * A profile as it stood before V10: created through the API, then stripped back to the NULL
	 * coordinates it would have carried. All three columns together, which is what the constraint
	 * in V11 requires and what such a row actually looked like.
	 */
	private void storedBeforeGeocoding(String subject, String slug, String postalCode) throws Exception {
		create(register(subject), slug, postalCode);

		jdbcTemplate.update("""
				UPDATE business_profile
				SET latitude = NULL, longitude = NULL, geocode_precision = NULL
				WHERE slug = ?
				""", slug);
	}

	private void replayTheMigration() throws SQLException {
		try (Connection connection = dataSource.getConnection()) {
			ScriptUtils.executeSqlScript(connection, new ClassPathResource(MIGRATION));
		}
	}

	private BigDecimal latitudeOf(String slug) {
		return jdbcTemplate.queryForObject(
				"SELECT latitude FROM business_profile WHERE slug = ?", BigDecimal.class, slug);
	}

	private String precisionOf(String slug) {
		return jdbcTemplate.queryForObject(
				"SELECT geocode_precision FROM business_profile WHERE slug = ?", String.class, slug);
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

	private void create(RequestPostProcessor token, String slug, String postalCode) throws Exception {
		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
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
								}""".formatted(slug, postalCode)))
				.andExpect(status().isCreated());
	}
}
