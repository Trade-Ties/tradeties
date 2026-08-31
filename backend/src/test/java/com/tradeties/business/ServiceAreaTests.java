package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The shape the radius search reads, and the one thing that has to stay true about it: that it
 * agrees with the coordinates beside it.
 *
 * <p>Everything here goes through SQL rather than through the entity, because the column is not
 * mapped and deliberately so — nothing in Java writes it. That also makes these tests a statement
 * about the database rather than about the code that happens to be calling it, which is the point
 * of generating the column in the first place.
 *
 * <p>Distances are the fixture's: Denver 80202 with the default 25-mile radius. Boulder is about
 * 24 miles out and Colorado Springs about 63, so one is inside the circle and the other is not,
 * with enough room that neither answer turns on the polygon's approximation of a curve.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ServiceAreaTests {

	private static final String BOULDER = "-105.20089, 40.04569";
	private static final String COLORADO_SPRINGS = "-104.82136, 38.83388";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	void aBusinessCoversWhatItSaysItTravelsTo() throws Exception {
		BusinessFixtures.businessFor(mockMvc, "user_area_basic", "area-basic");

		assertTrue(covers("area-basic", BOULDER), "24 miles out, inside a 25-mile radius");
		assertFalse(covers("area-basic", COLORADO_SPRINGS), "63 miles out, and not");
	}

	/**
	 * The area follows the point, and nothing in the application makes it. A business that moved
	 * and kept its old shape would answer searches at the address it left and miss the one it has
	 * — visible only as a search result that does not contain it.
	 */
	@Test
	void movingTheBusinessMovesTheArea() throws Exception {
		BusinessFixtures.businessFor(mockMvc, "user_area_moves", "area-moves");
		assertFalse(covers("area-moves", COLORADO_SPRINGS), "precondition: Denver does not reach it");

		// Colorado Springs' own centroid, written the way any writer writes coordinates.
		jdbcTemplate.update("""
				UPDATE business_profile SET latitude = 38.833880, longitude = -104.821360
				WHERE slug = 'area-moves'""");

		assertTrue(covers("area-moves", COLORADO_SPRINGS), "the shape moved with the point");
		assertFalse(covers("area-moves", BOULDER), "and left where it was");
	}

	/**
	 * The other input. A tradesperson who widens their radius expects to be found further out
	 * from the next search, not from the next time something happens to rewrite the row.
	 */
	@Test
	void wideningTheRadiusWidensTheArea() throws Exception {
		BusinessFixtures.businessFor(mockMvc, "user_area_radius", "area-radius");
		assertFalse(covers("area-radius", COLORADO_SPRINGS), "precondition: 25 miles is not enough");

		jdbcTemplate.update(
				"UPDATE business_profile SET service_radius_miles = 100 WHERE slug = 'area-radius'");

		assertTrue(covers("area-radius", COLORADO_SPRINGS));
	}

	/**
	 * The reason this column is generated rather than recomputed by whoever writes the point.
	 *
	 * <p>Two places move it: the write path on every save, and the background geocoder sharpening
	 * a ZIP centroid to an address — a bulk update that goes around the entity on purpose, so no
	 * lifecycle callback would have fired for it. Neither knows this column exists. The statement
	 * below is what that pass does, written the same way, and the area still follows.
	 */
	@Test
	void theAreaFollowsAWriterThatKnowsNothingAboutIt() throws Exception {
		BusinessFixtures.businessFor(mockMvc, "user_area_refined", "area-refined");

		jdbcTemplate.update("""
				UPDATE business_profile
				SET latitude = 38.833880, longitude = -104.821360,
				    geocode_precision = 'STREET', geocode_attempted_at = now()
				WHERE slug = 'area-refined'""");

		assertTrue(covers("area-refined", COLORADO_SPRINGS),
				"a bulk update that never mentions service_area still moves it");
	}

	/** No point, no shape — the same profile ADDRESS_GEOCODED refuses to publish. */
	@Test
	void aProfileWithoutAPointHasNoArea() throws Exception {
		BusinessFixtures.businessFor(mockMvc, "user_area_nopoint", "area-nopoint");

		jdbcTemplate.update("""
				UPDATE business_profile
				SET latitude = NULL, longitude = NULL, geocode_precision = NULL
				WHERE slug = 'area-nopoint'""");

		assertNull(jdbcTemplate.queryForObject(
				"SELECT service_area FROM business_profile WHERE slug = 'area-nopoint'", Object.class));
	}

	/** The question the search will ask, one profile at a time. */
	private boolean covers(String slug, String lonLat) {
		return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
				SELECT ST_Covers(service_area, ST_SetSRID(ST_MakePoint(%s), 4326)::geography)
				FROM business_profile WHERE slug = ?""".formatted(lonLat), Boolean.class, slug));
	}
}
