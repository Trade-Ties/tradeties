package com.tradeties;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * That the database image carries what the schema is allowed to ask for.
 *
 * <p>Without this, switching the image is a change nothing checks. The extensions are created by
 * Flyway, not by the image, so a wrong tag does not fail here — it fails in the migration that
 * first needs one, on whichever machine pulls next, with a message about a missing extension
 * rather than about the image that should have carried it.
 *
 * <p>Availability rather than installation, deliberately. Asking {@code pg_available_extensions}
 * proves the image without creating anything, so this test says nothing about which extensions
 * the schema actually uses and does not have to be revisited when that changes.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class DatabaseExtensionsTests {

	@Autowired
	JdbcTemplate jdbcTemplate;

	/**
	 * The two DECISIONS section 6 commits the marketplace to, and the reason the image is
	 * {@code postgis/postgis} rather than plain {@code postgres}: PostGIS answers "within N miles
	 * of this job site", pg_trgm answers a name typed with a typo. Both are PostgreSQL extensions
	 * rather than a search service beside the database, which is the decision this asserts.
	 */
	@Test
	void theImageCarriesTheExtensionsTheSearchNeeds() {
		List<String> available = jdbcTemplate.queryForList("""
				SELECT name FROM pg_available_extensions
				WHERE name IN ('postgis', 'pg_trgm', 'btree_gist')
				ORDER BY name
				""", String.class);

		assertEquals(List.of("btree_gist", "pg_trgm", "postgis"), available,
				"the database image is not the one the search slice is written against");
	}
}
