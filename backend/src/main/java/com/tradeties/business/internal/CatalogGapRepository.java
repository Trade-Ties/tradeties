package com.tradeties.business.internal;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
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
 * it whole — everything here is a native statement answering a projection or writing a decision.
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

	/**
	 * The queue, most asked first.
	 *
	 * <p>Ordered by count and then by phrase. The second half is not decoration: two phrases seen
	 * the same number of times would otherwise swap places between identical calls, which makes a
	 * list somebody is working through untrustworthy.
	 */
	@Query(value = """
			SELECT id AS id, source AS source, phrase AS phrase, seen_count AS seenCount,
			       first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt,
			       status AS status, promoted_to AS promotedTo
			FROM service_catalog_suggestion
			WHERE status = :status
			ORDER BY seen_count DESC, phrase ASC
			LIMIT :limit""", nativeQuery = true)
	List<SuggestionRow> withStatus(@Param("status") String status, @Param("limit") int limit);

	/** One row, whatever it was decided, so a caller can say why it refuses. */
	@Query(value = """
			SELECT id AS id, source AS source, phrase AS phrase, seen_count AS seenCount,
			       first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt,
			       status AS status, promoted_to AS promotedTo
			FROM service_catalog_suggestion
			WHERE id = :id""", nativeQuery = true)
	Optional<SuggestionRow> findById(@Param("id") UUID id);

	/**
	 * Records a decision, and only on a row that has not had one.
	 *
	 * <p>{@code status = 'NEW'} in the WHERE rather than checked beforehand, so that two people
	 * working the same list cannot both decide the same phrase. The caller reads the row count:
	 * zero means somebody got there first, and that is a conflict rather than a failure.
	 */
	@Modifying
	@Query(value = """
			UPDATE service_catalog_suggestion
			SET status = :status, promoted_to = :promotedTo
			WHERE id = :id AND status = 'NEW'""", nativeQuery = true)
	int decide(@Param("id") UUID id, @Param("status") String status, @Param("promotedTo") UUID promotedTo);

	/** The shape the queue answers in. */
	interface SuggestionRow {

		UUID getId();

		String getSource();

		String getPhrase();

		int getSeenCount();

		Instant getFirstSeenAt();

		Instant getLastSeenAt();

		String getStatus();

		UUID getPromotedTo();
	}
}
