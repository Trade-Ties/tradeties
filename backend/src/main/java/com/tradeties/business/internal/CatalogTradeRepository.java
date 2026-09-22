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
	 *
	 * <p>A MATCH HAS TO ACCOUNT FOR THE SENTENCE, not merely score against it, which is what the
	 * word count below is for. Any-word matching means one incidental shared word scores a trade,
	 * and the caller does not treat these as a shortlist — every trade returned widens the
	 * businesses the customer is shown. "Toilet is leaking" is the case that showed it: Plumber
	 * matches both words, Roofer matches `leak` alone out of "roof leak" and "gutters leaking",
	 * and a roofer arrived in front of somebody with a leaking toilet.
	 *
	 * <p>This used to be a fraction of the best score, and that could not be made to work. Roofer
	 * scored 0.500 of Plumber on the toilet — plainly wrong — while Painter scored 0.750 on "water
	 * is coming through the ceiling", which is a fair second answer. No single cut separates them.
	 * The word count does, and without a threshold at all: across every description measured, each
	 * wrong trade had matched exactly one word and each right one more.
	 *
	 * <p><strong>So the rule is a comparison, not a constant.</strong> Keep the trades that
	 * account for as much of the description as the best one does. Nothing to tune, nothing to
	 * redeploy when it needs tuning, and it holds for sentences nobody has written vocabulary
	 * for — which is the only kind that matters here.
	 *
	 * <p>Ambiguity survives it, because a genuine tie is a tie in word count too: "there is a hole
	 * in the bathtub" reaches Plumber and Painter on one word each, and "water damage in the
	 * parquet floor" reaches Flooring and Roofer on two. What no longer survives is the accidental
	 * kind, where one trade simply happened to share a word.
	 *
	 * <p>{@code ts_rank} keeps its job and loses the other one: it orders the survivors, and no
	 * longer decides who they are.
	 */
	@Query(value = """
			SELECT t.id, t.code, t.display_name,
			       ts_rank(t.search_vector, any_word(:description)) AS score
			FROM trade t
			WHERE t.active
			  AND t.search_vector @@ any_word(:description)
			  AND words_matched(t.search_vector, :description) = (
			          SELECT max(words_matched(best.search_vector, :description))
			          FROM trade best
			          WHERE best.active AND best.search_vector @@ any_word(:description))
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
