package com.tradeties.business.internal;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The record of what people ask for that the catalogue cannot name.
 *
 * <p>A bare {@link Repository}: there is no entity for this table, because nothing loads a row of
 * it whole — the one statement here is native, and it writes rather than reads.
 */
interface CatalogGapRepository extends Repository<CatalogTrade, UUID> {

	/**
	 * One sighting of a phrase: a new row, or one more on the row that is already there.
	 *
	 * <p>Native and an upsert, because the alternative is a read followed by a write and the race
	 * between them. Two customers typing the same unknown phrase at once would both find nothing,
	 * both insert, and one would fail on the unique index — turning a bookkeeping note into an
	 * error on somebody's search.
	 *
	 * <p>{@code ON CONFLICT} keys on the same expression the index does, which is what makes a
	 * second sighting a count rather than a second row.
	 *
	 * <p><strong>{@code REQUIRES_NEW} lives here rather than on the caller,</strong> and not as a
	 * matter of taste: the component above calls this through Spring's proxy, where the annotation
	 * takes effect, while a method calling a neighbour in its own class would bypass it silently
	 * and inherit whichever transaction it was already in — the search's read-only one, which
	 * would refuse the write, or a service creation's, which this must not be able to roll back.
	 *
	 * <p>{@code first_seen_at} is never touched again on purpose. It is the only thing here that
	 * says how long something has been asked for without an answer, and "since March" reads
	 * differently from "eighteen times".
	 */
	@Modifying
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	@Query(value = """
			INSERT INTO service_catalog_suggestion (id, source, phrase, seen_count, first_seen_at, last_seen_at)
			VALUES (gen_random_uuid(), :source, :phrase, 1, :seenAt, :seenAt)
			ON CONFLICT (source, lower(phrase))
			DO UPDATE SET
			    seen_count = service_catalog_suggestion.seen_count + 1,
			    last_seen_at = EXCLUDED.last_seen_at""", nativeQuery = true)
	void sighted(@Param("source") String source,
			@Param("phrase") String phrase,
			@Param("seenAt") Instant seenAt);
}
