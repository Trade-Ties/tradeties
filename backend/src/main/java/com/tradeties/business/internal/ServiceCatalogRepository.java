package com.tradeties.business.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * The catalogue as a list: every job the marketplace has a name for, and the trade each is filed
 * under.
 *
 * <p>A bare {@link Repository} for the reason {@link BusinessSearchRepository} is one: what this
 * needs is a handful of named statements, not the twenty methods a {@code JpaRepository} would
 * inherit onto it.
 *
 * <p><strong>{@link CatalogTrade} in the type parameter is a formality, and the mismatch is
 * deliberate.</strong> Spring Data wants a domain type; {@code service_catalog} has no entity
 * because nothing in Java loads a row of it whole — the queries here are native and answer
 * projections. Adding an entity to satisfy the signature would be adding a mapping for a table
 * only Flyway writes, which is the same reason V17's generated column has none.
 */
interface ServiceCatalogRepository extends Repository<CatalogTrade, UUID> {

	/**
	 * Every job the catalogue holds, in trade order and then catalogue order.
	 *
	 * <p>Unfiltered on purpose. The caller that wants one business's jobs narrows by trade
	 * itself, against the trades it holds right now — filtering here would answer for the trades
	 * held when the page loaded, and step 3 is the screen before the one that asks.
	 *
	 * <p>An inactive trade takes its jobs with it: a job nothing can be filed under is not a
	 * choice, and offering it would be offering a refusal from the composite foreign key.
	 */
	@Query(value = """
			SELECT c.id AS id, c.code AS code, c.label AS label, c.trade_id AS tradeId
			FROM service_catalog c
			JOIN trade t ON t.id = c.trade_id
			WHERE c.active AND t.active
			ORDER BY t.sort_order ASC, c.sort_order ASC""", nativeQuery = true)
	List<JobRow> findAllActive();

	/**
	 * The trade a catalogue job is filed under, for checking that a service claiming it agrees.
	 *
	 * <p>Empty for a job that does not exist or has been retired, and the caller treats both the
	 * same way — from a client's side they are the same mistake.
	 */
	@Query(value = "SELECT c.trade_id FROM service_catalog c WHERE c.active AND c.id = :catalogId",
			nativeQuery = true)
	Optional<UUID> findTradeOf(@Param("catalogId") UUID catalogId);

	/** The shape {@link #findAllActive} answers in. */
	interface JobRow {

		UUID getId();

		String getCode();

		String getLabel();

		UUID getTradeId();
	}
}
