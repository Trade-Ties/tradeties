package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The seeded service catalogue, checked for the failures a repeatable migration actually has.
 *
 * <p>No row count is pinned. The catalogue is hand-maintained and grows whenever somebody learns
 * a job customers ask for, so a number here would fail every honest addition — which trains
 * people to edit the test rather than read it.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ServiceCatalogSeedTests {

	@Autowired
	JdbcTemplate jdbcTemplate;

	/**
	 * The whole reason R__trade_service_catalog.sql is named the way it is.
	 *
	 * <p>Every row in that file joins {@code trade} to resolve its trade code, and the trades are
	 * seeded by a second repeatable. Flyway runs repeatables in order of description, so the file
	 * has to sort after "trade reference data" — which is why it carries a prefix that reads
	 * oddly. Get the name wrong and nothing raises: the join matches an empty table, INSERT writes
	 * zero rows, Flyway reports success and the marketplace comes up with an empty catalogue.
	 *
	 * <p>That is the failure this test exists for, and it is the only one of these that a rename
	 * would trip.
	 */
	@Test
	void theCatalogueIsSeededAtAll() {
		Integer entries = jdbcTemplate.queryForObject("SELECT count(*) FROM service_catalog", Integer.class);

		assertTrue(entries != null && entries > 0,
				"empty catalogue — R__trade_service_catalog.sql probably ran before the trades existed");
	}

	/**
	 * A trade taken off the market takes its catalogue entries with it, or it should. Nothing in
	 * the schema says so: the foreign key checks that the trade exists, not that it is still
	 * offered, so an entry can go on being suggested to customers for a trade no business can
	 * hold any more.
	 */
	@Test
	void everyEntryIsFiledUnderAnActiveTrade() {
		List<String> orphaned = jdbcTemplate.queryForList("""
				SELECT c.code
				FROM service_catalog c
				JOIN trade t ON t.id = c.trade_id
				WHERE c.active AND NOT t.active
				""", String.class);

		assertEquals(List.of(), orphaned, "active entries under a retired trade");
	}

	/**
	 * An entry with no synonyms is reachable only by typing its label exactly, which is the one
	 * thing a customer will not do — the label is written in their words, but not in the specific
	 * words any one of them picks. The column is nullable because a draft entry is legitimate;
	 * shipping one is not.
	 */
	@Test
	void everyEntryCanBeFoundByMoreThanItsOwnLabel() {
		List<String> bare = jdbcTemplate.queryForList("""
				SELECT code
				FROM service_catalog
				WHERE active AND coalesce(btrim(synonyms), '') = ''
				""", String.class);

		assertEquals(List.of(), bare, "entries findable only by their exact label");
	}
}
