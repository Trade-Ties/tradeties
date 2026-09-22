package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * The catalogue read two ways: as a list, and as the customer meets it — half a typed word in,
 * jobs out.
 *
 * <p>A bare {@link Repository} for the reason {@link BusinessSearchRepository} is one: what this
 * needs is a handful of named statements, not the twenty methods a {@code JpaRepository} would
 * inherit onto it.
 *
 * <p><strong>Java writes this table now, which it did not when V18 was written.</strong> One
 * statement, {@link #add}, and it exists because the catalogue has to be able to grow without a
 * deployment — a suggestion promoted by staff is a row here, written while the application runs.
 * The seed in {@code R__trade_service_catalog.sql} plants what is missing and never overwrites,
 * precisely so the two cannot fight.
 *
 * <p><strong>{@link CatalogTrade} in the type parameter is a formality, and the mismatch is
 * deliberate.</strong> Spring Data wants a domain type; {@code service_catalog} has no entity
 * because nothing in Java loads a row of it whole — the queries here are native and answer
 * projections. Adding an entity to satisfy the signature would be adding a mapping for a table
 * with a generated column no Java code may write, which is the same reason V17's has none.
 */
interface ServiceCatalogRepository extends Repository<CatalogTrade, UUID> {

	/**
	 * Catalogue entries whose label or synonyms begin like what was typed, best first.
	 *
	 * <p>Native, because {@code tsvector}, the match operator, {@code ts_rank} and PostGIS are
	 * PostgreSQL's, and {@code suggest_vector} is a generated column no entity maps.
	 *
	 * <p>{@code any_prefix} is V20's, and it replaced a version that joined the same prefixes with
	 * AND. That asked every typed word to match, so one filler word emptied the list: "Toilet is
	 * leaking" matched nothing, because no entry contains a word beginning "is". Anybody typing a
	 * sentence rather than keywords hit it, and an empty dropdown does not look like a fault.
	 *
	 * <p><strong>OR, then counted.</strong> {@code prefixes_matched} says how many of the typed
	 * words an entry begins one of, and that both orders the list and decides who is on it. A word
	 * that fits nothing contributes nothing — whether it is "is", "urgently", or a typo — so no
	 * stop-word list has to know about it in advance. Which matters twice over here: a list would
	 * have to be maintained and deployed, and the catalogue's own text contains "is", "my" and
	 * "the" ("water is running now", "my list", "Replace the roof"), so the vocabulary could not
	 * have served as one.
	 *
	 * <p><strong>Half the words, rounded up, is the floor.</strong> Without one, "is my the" would
	 * answer with whatever happens to contain a word starting "is" — three words in, one match is
	 * not an answer. With it, one typed word still needs one match, and a sentence needs to be
	 * half accounted for. It is the only number in this query, and it is a share rather than a
	 * word list precisely so that changing it is a setting and not a release.
	 *
	 * <p><strong>Ranked by match, not by availability.</strong> Word count first, then the weights
	 * from V19 that put a hit on the label above a hit on the synonyms. Sorting available jobs
	 * first would promote a weak match over a strong one because somebody nearby happens to offer
	 * it, which reads as a broken search box; {@code offeredNearby} is a badge instead.
	 * {@code sort_order} breaks the last tie, so two entries the letters do not separate come back
	 * in the same order every time.
	 *
	 * <p><strong>Nothing is dropped for having no supplier.</strong> The availability test is a
	 * column, never a {@code WHERE} clause. A job nobody nearby offers is the one thing an empty
	 * answer can never report, and hiding it would leave the customer unable to say what they
	 * need and TradeTies unable to learn that they wanted it.
	 *
	 * <p><strong>The {@code CASE} is how "nobody asked" stays different from "we looked".</strong>
	 * With no postal code there is no point to test against, and answering false would be a claim
	 * nobody made. PostgreSQL does not evaluate a {@code CASE} branch it does not need, so the
	 * subquery and its PostGIS call cost nothing on that path.
	 *
	 * <p>The supply test is the same shape the search uses — published, and the customer inside
	 * the business's own declared area rather than within some distance of it — plus the two
	 * conditions that belong to a service rather than to a business: not deactivated, and not
	 * soft-deleted. A service the tradesperson has switched off is not on offer.
	 *
	 * @param haveOrigin whether latitude and longitude carry a real point. False leaves them
	 *        unread; pass anything
	 */
	@Query(value = """
			SELECT c.code           AS code,
			       c.label          AS label,
			       t.code           AS tradeCode,
			       t.display_name   AS tradeDisplayName,
			       CASE WHEN :haveOrigin THEN EXISTS (
			           SELECT 1
			           FROM business_service s
			           JOIN business_profile b ON b.id = s.business_id
			           WHERE s.catalog_id = c.id
			             AND s.active
			             AND s.deleted_at IS NULL
			             AND b.status = 'PUBLISHED'
			             AND ST_Covers(
			                     b.service_area,
			                     ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography))
			       END              AS offeredNearby
			FROM service_catalog c
			JOIN trade t ON t.id = c.trade_id
			WHERE c.active
			  AND t.active
			  AND c.suggest_vector @@ any_prefix(:typed)
			  AND prefixes_matched(c.suggest_vector, :typed)
			      >= ceil(words_typed(:typed) * :minimumShare)
			ORDER BY prefixes_matched(c.suggest_vector, :typed) DESC,
			         ts_rank(c.suggest_vector, any_prefix(:typed)) DESC,
			         c.sort_order ASC
			LIMIT :limit""", nativeQuery = true)
	List<SuggestionRow> suggest(@Param("typed") String typed,
			@Param("haveOrigin") boolean haveOrigin,
			@Param("latitude") BigDecimal latitude,
			@Param("longitude") BigDecimal longitude,
			@Param("minimumShare") double minimumShare,
			@Param("limit") int limit);


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
	 * A new job, promoted from a phrase somebody collected.
	 *
	 * <p>Appended: the position is the end of the catalogue rather than the end of its trade, so
	 * a promoted job sorts last until somebody moves it. Ordering inside a trade is editorial and
	 * nobody has asked to do it from here.
	 *
	 * <p>The generated column V19 added fills itself, so nothing here mentions the suggestion
	 * vector — which is the reason this is an INSERT and not an entity: there is a column no Java
	 * code may write.
	 *
	 * <p>The id is chosen by the caller rather than by the database, as every seeded row's is.
	 * It is what lets the promotion write the catalogue entry and the decision that points at it
	 * in one transaction without reading anything back in between.
	 *
	 * <p>Every parameter is cast. PostgreSQL infers a parameter's type from where it sits, and in
	 * a SELECT list there is nothing to infer from — an uncast one fails with "could not determine
	 * data type", at runtime, on the first promotion anybody tries.
	 */
	@Modifying
	@Query(value = """
			INSERT INTO service_catalog (id, code, trade_id, label, synonyms, sort_order, active)
			SELECT CAST(:id AS uuid), CAST(:code AS varchar), CAST(:tradeId AS uuid),
			       CAST(:label AS varchar), CAST(:synonyms AS text),
			       coalesce(max(sort_order), 0) + 10, TRUE
			FROM service_catalog""", nativeQuery = true)
	int add(@Param("id") UUID id,
			@Param("code") String code,
			@Param("tradeId") UUID tradeId,
			@Param("label") String label,
			@Param("synonyms") String synonyms);

	/** Whether a code is taken, so a derived one can be refused before it collides. */
	@Query(value = "SELECT EXISTS (SELECT 1 FROM service_catalog WHERE code = :code)", nativeQuery = true)
	boolean hasCode(@Param("code") String code);

	/**
	 * Whether a job already goes by this name.
	 *
	 * <p>Checked as well as the code, and it is the one that matters. V18's rule is one entry per
	 * customer job, and two entries reading the same in a dropdown is the failure that table
	 * exists to prevent — while the codes behind them can differ by a word order nobody sees:
	 * "Replace a toilet" is already {@code PLUMBER_TOILET_REPLACE}, and promoting the same label
	 * would derive {@code PLUMBER_REPLACE_A_TOILET}, which collides with nothing and duplicates
	 * everything.
	 *
	 * <p>Case-insensitive, matching the index that enforces it.
	 */
	@Query(value = "SELECT EXISTS (SELECT 1 FROM service_catalog WHERE lower(label) = lower(:label))",
			nativeQuery = true)
	boolean hasLabel(@Param("label") String label);


	/**
	 * Whether the catalogue can name what somebody typed at all.
	 *
	 * <p>The same test {@link #suggest} applies, without the ranking, the availability or the
	 * limit — the question is not which job is best but whether any exists. False is the signal
	 * worth keeping: a description the catalogue has no word for is a gap in the catalogue, and
	 * the only place that becomes visible is here, because the search still answers by trade and
	 * looks like it worked.
	 */
	@Query(value = """
			SELECT EXISTS (
			    SELECT 1 FROM service_catalog c
			    JOIN trade t ON t.id = c.trade_id
			    WHERE c.active
			      AND t.active
			      AND c.suggest_vector @@ any_prefix(:typed)
			      AND prefixes_matched(c.suggest_vector, :typed)
			          >= ceil(words_typed(:typed) * :minimumShare))""", nativeQuery = true)
	boolean canName(@Param("typed") String typed, @Param("minimumShare") double minimumShare);

	/**
	 * One job by the code a customer's pick carried.
	 *
	 * <p>Empty for a code the catalogue does not list, and the caller answers that the way an
	 * unknown postal code is answered: a refusal rather than an empty result. It can only come
	 * from a stale link or a hand-edited URL, and "nobody near you does this" would blame the
	 * wrong thing.
	 *
	 * <p>A retired job is absent too, and an active job under a retired trade with it — nothing
	 * can be filed under that trade any more, so narrowing to it would answer nobody while
	 * looking like it had answered.
	 */
	@Query(value = """
			SELECT c.id AS id, c.code AS code, c.label AS label, c.trade_id AS tradeId
			FROM service_catalog c
			JOIN trade t ON t.id = c.trade_id
			WHERE c.active AND t.active AND c.code = :code""", nativeQuery = true)
	Optional<JobRow> findByCode(@Param("code") String code);

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

	/** The shape {@link #suggest} answers in, before it becomes a {@code ServiceSuggestion}. */
	interface SuggestionRow {

		String getCode();

		String getLabel();

		String getTradeCode();

		String getTradeDisplayName();

		/** Null when no postal code was given, and that is not the same as false. */
		Boolean getOfferedNearby();
	}
}
