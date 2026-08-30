package com.tradeties.business.internal;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface CatalogTradeRepository extends JpaRepository<CatalogTrade, UUID> {

	/**
	 * Inactive trades are never offered. One taken off the market stays in the table because
	 * existing profiles point at it — it just stops being a choice.
	 */
	List<CatalogTrade> findByActiveTrueOrderBySortOrderAsc();

	/**
	 * The trades a free-text description could mean, best first.
	 *
	 * <p>Native, because none of this exists in JPQL: {@code tsvector}, the match operator and
	 * {@code ts_rank} are PostgreSQL's, and the vector is a generated column the entity does not
	 * map — nothing in Java writes it, so nothing in Java needs to see it.
	 *
	 * <p>{@code any_word} treats the description as a handful of clues rather than a
	 * specification; V17 says why that matters. It answers null for input carrying no searchable
	 * word, and {@code @@ null} matches nothing — so an empty description is an empty list rather
	 * than every trade.
	 *
	 * <p>Ties break on {@code sort_order}, which is the catalogue's own order and stable. Without
	 * it, two trades a description does not separate would swap places between identical calls.
	 */
	@Query(value = """
			SELECT t.id, t.code, t.display_name, ts_rank(t.search_vector, any_word(:description)) AS score
			FROM trade t
			WHERE t.active AND t.search_vector @@ any_word(:description)
			ORDER BY score DESC, t.sort_order ASC
			LIMIT :limit""", nativeQuery = true)
	List<TradeMatchRow> findMatching(@Param("description") String description, @Param("limit") int limit);

	/** The shape {@link #findMatching} answers in, before it becomes a {@code TradeMatch}. */
	interface TradeMatchRow {

		UUID getId();

		String getCode();

		String getDisplayName();

		double getScore();
	}
}
