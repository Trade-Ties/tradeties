package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;
import com.tradeties.business.GeoPoint;
import com.tradeties.business.PostalAddress;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The background pass, driven by hand.
 *
 * <p>Scheduling is off in the suite — {@code src/test/resources/application.properties} — so
 * nothing here happens on a timer and nothing reaches the real Census service. This context turns
 * the bean on so it can be called, and stubs the geocoder so the pass has an answer to record.
 *
 * <p>A batch size of two, because one of the things worth proving is that the pass stops at it.
 *
 * <p>Every test starts by stamping every profile in the shared database as just attempted, which
 * empties the queue. Other classes leave profiles behind at ZIP precision — they are not this
 * class' fixtures, and a pass that swept them up would make these assertions depend on the order
 * the suite happened to run in.
 */
@SpringBootTest(properties = {
		"tradeties.census.refiner.enabled=true",
		"tradeties.census.refiner.batch-size=2" })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class GeocodeRefinerTests {

	private static final GeoPoint SHARPER = new GeoPoint(
			new BigDecimal("39.742008"), new BigDecimal("-104.987336"));

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Autowired
	GeocodeRefiner refiner;

	@MockitoBean
	CensusGeocoder census;

	@BeforeEach
	void emptyTheQueue() {
		jdbcTemplate.update("UPDATE business_profile SET geocode_attempted_at = now()");
	}

	@Test
	void aProfileOnAZipCentroidIsSharpenedToStreetLevel() throws Exception {
		givenAProfileWaiting("user_refine_hit", "refine-hit");
		when(census.locate(any())).thenReturn(Optional.of(new Geocode(SHARPER, GeocodePrecision.STREET)));

		refiner.refineABatch();

		Map<String, Object> row = profile("refine-hit");
		assertEquals(0, SHARPER.latitude().compareTo((BigDecimal) row.get("latitude")));
		assertEquals(0, SHARPER.longitude().compareTo((BigDecimal) row.get("longitude")));
		assertEquals("STREET", row.get("geocode_precision"));
	}

	/**
	 * The case the attempt stamp exists for. An address the service cannot match keeps its
	 * centroid and stays usable — and is marked as looked at, so it leaves the queue instead of
	 * being asked about on every pass for the rest of the profile's life.
	 */
	@Test
	void anUnmatchedAddressKeepsItsCentroidAndLeavesTheQueue() throws Exception {
		givenAProfileWaiting("user_refine_miss", "refine-miss");
		BigDecimal centroid = (BigDecimal) profile("refine-miss").get("latitude");
		when(census.locate(any())).thenReturn(Optional.empty());

		refiner.refineABatch();

		Map<String, Object> row = profile("refine-miss");
		assertEquals(0, centroid.compareTo((BigDecimal) row.get("latitude")), "the centroid stands");
		assertEquals("ZIP", row.get("geocode_precision"));
		assertNotNull(row.get("geocode_attempted_at"), "asked, and recorded as asked");
	}

	/**
	 * The queue is the precision column. A profile already at street level is not in it, and asking
	 * about it again would spend a call to learn what is already stored.
	 */
	@Test
	void aProfileAlreadyAtStreetLevelIsNotAskedAbout() throws Exception {
		givenAProfileWaiting("user_refine_done", "refine-done");
		jdbcTemplate.update("""
				UPDATE business_profile SET geocode_precision = 'STREET', geocode_attempted_at = NULL
				WHERE slug = 'refine-done'""");

		refiner.refineABatch();

		verify(census, never()).locate(any());
	}

	/** Asked recently means not asked again. Without this a permanent failure is a permanent cost. */
	@Test
	void aProfileAskedAboutRecentlyIsSkipped() throws Exception {
		givenAProfileWaiting("user_refine_recent", "refine-recent");
		jdbcTemplate.update(
				"UPDATE business_profile SET geocode_attempted_at = now() WHERE slug = 'refine-recent'");

		refiner.refineABatch();

		verify(census, never()).locate(any());
	}

	@Test
	void aPassStopsAtTheBatchSize() throws Exception {
		givenAProfileWaiting("user_refine_one", "refine-one");
		givenAProfileWaiting("user_refine_two", "refine-two");
		givenAProfileWaiting("user_refine_three", "refine-three");
		when(census.locate(any())).thenReturn(Optional.empty());

		refiner.refineABatch();

		assertEquals(1, jdbcTemplate.queryForObject("""
				SELECT COUNT(*) FROM business_profile
				WHERE slug IN ('refine-one', 'refine-two', 'refine-three')
				  AND geocode_attempted_at IS NULL""", Integer.class),
				"three waiting, two per pass, one left for the next");
	}

	/**
	 * The reason this writes through a bulk update rather than the entity. A version bump would
	 * refuse the next save of whichever tradesperson has the wizard open, as a conflict with
	 * nobody; a moved {@code updated_at} would tell every owner their profile was edited on a day
	 * nobody touched it.
	 */
	@Test
	void sharpeningIsNotAnEditToTheProfile() throws Exception {
		givenAProfileWaiting("user_refine_quiet", "refine-quiet");
		Map<String, Object> before = profile("refine-quiet");
		when(census.locate(any())).thenReturn(Optional.of(new Geocode(SHARPER, GeocodePrecision.STREET)));

		refiner.refineABatch();

		Map<String, Object> after = profile("refine-quiet");
		assertEquals(before.get("version"), after.get("version"), "the wizard's held version");
		assertEquals(before.get("updated_at"), after.get("updated_at"), "when the owner last edited");
	}

	/** The address the pass sends is the stored one, assembled from the columns rather than guessed. */
	@Test
	void theStoredAddressIsWhatGetsLookedUp() throws Exception {
		givenAProfileWaiting("user_refine_address", "refine-address");
		when(census.locate(any())).thenReturn(Optional.empty());

		refiner.refineABatch();

		verify(census).locate(new PostalAddress("123 Main St", null, "Denver", "CO", "80202"));
	}

	/**
	 * A profile whose postal code resolved to nothing is in the queue, and it is the one that
	 * needs it most.
	 *
	 * <p>It has no point at all, so it is in no radius search and {@code ADDRESS_GEOCODED} will
	 * not let it go live. The ZIP lookup has already failed on it by definition — that is why the
	 * precision is null — so leaving it out of the queue would leave its owner a refusal naming a
	 * postal code they typed correctly and nothing they could do about it. This pass reads the
	 * street, so it is the one thing that can still place them.
	 */
	@Test
	void aProfileWithNoCoordinatesAtAllIsInTheQueue() throws Exception {
		givenAProfileWaiting("user_refine_nopoint", "refine-nopoint");
		jdbcTemplate.update("""
				UPDATE business_profile
				SET latitude = NULL, longitude = NULL, geocode_precision = NULL
				WHERE slug = 'refine-nopoint'""");
		when(census.locate(any())).thenReturn(Optional.of(new Geocode(SHARPER, GeocodePrecision.STREET)));

		refiner.refineABatch();

		assertEquals(0, SHARPER.latitude().compareTo((BigDecimal) profile("refine-nopoint").get("latitude")),
				"the address-level service is the only thing that can place this profile");
		assertEquals("STREET", profile("refine-nopoint").get("geocode_precision"));
	}

	/**
	 * And when the address-level service cannot place it either, the attempt is still recorded —
	 * so it waits out the retry window rather than being asked about on every pass.
	 */
	@Test
	void aProfileWithNoCoordinatesThatStillCannotBePlacedIsStamped() throws Exception {
		givenAProfileWaiting("user_refine_nofix", "refine-nofix");
		jdbcTemplate.update("""
				UPDATE business_profile
				SET latitude = NULL, longitude = NULL, geocode_precision = NULL
				WHERE slug = 'refine-nofix'""");
		when(census.locate(any())).thenReturn(Optional.empty());

		refiner.refineABatch();

		assertNull(profile("refine-nofix").get("latitude"));
		assertNull(profile("refine-nofix").get("geocode_precision"));
		assertNotNull(profile("refine-nofix").get("geocode_attempted_at"));
	}

	/**
	 * A business that moves is back on the queue at once, not when the retry window expires.
	 *
	 * <p>The queue takes two columns, and a save only resets one of them. A profile sharpened
	 * yesterday carries yesterday's attempt stamp; leave it there and the new address sits on the
	 * centroid of its new ZIP for the length of the retry window — a month, silently, with nothing
	 * looking wrong. That is why {@code apply} clears the stamp when the address moves, and this
	 * is the test that says so.
	 */
	@Test
	void aBusinessThatMovesIsBackOnTheQueueImmediately() throws Exception {
		RequestPostProcessor token = givenAProfileWaiting("user_refine_moved", "refine-moved");
		when(census.locate(any())).thenReturn(Optional.of(new Geocode(SHARPER, GeocodePrecision.STREET)));
		refiner.refineABatch();
		assertEquals("STREET", profile("refine-moved").get("geocode_precision"), "precondition");

		moveTo(token, "refine-moved", "80301");

		Map<String, Object> waiting = profile("refine-moved");
		assertEquals("ZIP", waiting.get("geocode_precision"), "back to the centroid of the new ZIP");
		assertNull(waiting.get("geocode_attempted_at"), "and back on the queue, not held for 30 days");
	}

	/**
	 * The other half of the same rule. A save that leaves the address alone must not clear the
	 * stamp, or an address the service can never match would be asked about again every time its
	 * owner edited a description.
	 */
	@Test
	void aSaveThatDoesNotMoveTheBusinessLeavesTheStampAlone() throws Exception {
		RequestPostProcessor token = givenAProfileWaiting("user_refine_stay", "refine-stay");
		when(census.locate(any())).thenReturn(Optional.empty());
		refiner.refineABatch();
		assertNotNull(profile("refine-stay").get("geocode_attempted_at"), "precondition");

		moveTo(token, "refine-stay", "80202");

		assertNotNull(profile("refine-stay").get("geocode_attempted_at"),
				"same address, so the retry window still stands");
	}

	/**
	 * Replaces steps 1 and 2 with the same profile at the given postal code, reading the stored
	 * version first rather than assuming it.
	 */
	private void moveTo(RequestPostProcessor token, String slug, String postalCode) throws Exception {
		String stored = mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "version": %s,
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
								}""".formatted(JsonPath.read(stored, "$.version").toString(), slug, postalCode)))
				.andExpect(status().isOk());
	}

	/** Created through the API, so it is placed by its ZIP, then put back on the queue. */
	private RequestPostProcessor givenAProfileWaiting(String subject, String slug) throws Exception {
		RequestPostProcessor token = BusinessFixtures.businessFor(mockMvc, subject, slug);
		jdbcTemplate.update(
				"UPDATE business_profile SET geocode_attempted_at = NULL WHERE slug = ?", slug);
		return token;
	}

	private Map<String, Object> profile(String slug) {
		return jdbcTemplate.queryForMap("SELECT * FROM business_profile WHERE slug = ?", slug);
	}
}
