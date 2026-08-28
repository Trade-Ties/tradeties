package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;

import com.tradeties.TestcontainersConfiguration;
import com.tradeties.business.GeoPoint;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The seeded ZIP centroids, checked for the failures a generated file actually has.
 *
 * <p>None of these assert a row count. The dataset gets a new vintage every year and ZCTAs come
 * and go with it, so a pinned number would fail on every regeneration for no reason — and the
 * failures worth catching are a truncated file and a point in the wrong hemisphere, neither of
 * which a count would notice.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ZipCentroidTests {

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Autowired
	CatalogZipRepository zips;

	/**
	 * The tripwire, and the reason it is a test rather than a CHECK constraint: it encodes the
	 * market as it stands today. A territory added on purpose should fail a build and be read,
	 * not be rejected by the database at seed time.
	 *
	 * <p>The southern bound is the one that earns its keep. American Samoa (96799) sits under
	 * prefix 967 — which is Hawaii — so a filter written on three-digit prefixes alone drops the
	 * other territories and keeps that one. At latitude -14 it is the only row this catches.
	 */
	@Test
	void everySeededPointLiesWithinTheFiftyStates() {
		Bounds bounds = jdbcTemplate.queryForObject(
				"""
						SELECT MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude)
						FROM zip_centroid
						""",
				(rs, row) -> new Bounds(rs.getBigDecimal(1), rs.getBigDecimal(2),
						rs.getBigDecimal(3), rs.getBigDecimal(4)));

		// Hawaii's Big Island in the south, Point Barrow in the north; the Aleutians in the west,
		// Maine in the east. Rounded outwards, so a shifted centroid does not fail the build.
		assertBetween("southernmost latitude", bounds.minLatitude(), 19, 72);
		assertBetween("northernmost latitude", bounds.maxLatitude(), 19, 72);
		assertBetween("westernmost longitude", bounds.minLongitude(), -177, -66);
		assertBetween("easternmost longitude", bounds.maxLongitude(), -177, -66);
	}

	/**
	 * Named one by one rather than derived, because this is the list `us_state` and `time_zone`
	 * already stop at. A ZIP here that no business can have is not harmful on its own — it is
	 * the disagreement between the three tables that is.
	 */
	@Test
	void noTerritoryZipsAreSeeded() {
		List<String> found = jdbcTemplate.queryForList(
				"""
						SELECT zip FROM zip_centroid
						WHERE LEFT(zip, 3) IN ('006', '007', '008', '009', '969')
						   OR zip = '96799'
						ORDER BY zip
						""",
				String.class);

		assertEquals(List.of(), found, "Puerto Rico, the Virgin Islands, Guam, the Northern "
				+ "Marianas and American Samoa are outside the market us_state describes");
	}

	/** A truncated or half-written file, which the bounds above would pass without noticing. */
	@Test
	void theWholeCountryIsSeededAndNotJustPartOfIt() {
		Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM zip_centroid", Integer.class);

		assertTrue(count != null && count > 30_000,
				"the gazetteer holds around 33,600 usable ZCTAs, found " + count);
	}

	/**
	 * The mapping, end to end. Hibernate runs {@code ddl-auto: validate}, so the column types are
	 * already proven by the context starting — what this adds is that the two numbers survive the
	 * round trip in the right order and the right scale.
	 */
	@Test
	void aKnownZipReadsBackAsItsPoint() {
		GeoPoint denver = zips.findById("80202").orElseThrow().toPoint();

		assertEquals(0, denver.latitude().compareTo(new BigDecimal("39.751526")), "latitude of 80202");
		assertEquals(0, denver.longitude().compareTo(new BigDecimal("-104.997673")), "longitude of 80202");
	}

	/** A ZIP the dataset does not carry — PO-box-only codes have no ZCTA — is a normal answer. */
	@Test
	void anUnknownZipIsEmptyRatherThanAnError() {
		assertTrue(zips.findById("00000").isEmpty());
	}

	private static void assertBetween(String what, BigDecimal actual, int low, int high) {
		assertTrue(actual.compareTo(BigDecimal.valueOf(low)) >= 0
						&& actual.compareTo(BigDecimal.valueOf(high)) <= 0,
				what + " is " + actual + ", outside " + low + ".." + high);
	}

	private record Bounds(BigDecimal minLatitude, BigDecimal maxLatitude,
			BigDecimal minLongitude, BigDecimal maxLongitude) {
	}
}
