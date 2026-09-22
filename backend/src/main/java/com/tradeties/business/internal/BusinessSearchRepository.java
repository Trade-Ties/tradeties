package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.NextAvailability;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * What the customer side asks, kept apart from {@link BusinessProfileRepository} because it is a
 * different question. Everything there takes an owner and answers about one profile; this takes no
 * owner, reads across the whole table, and answers with what a stranger may see.
 *
 * <p>A bare {@link Repository} rather than a {@code JpaRepository}: there is nothing to save here
 * and no id to load by, and inheriting twenty write methods onto the anonymous read path would be
 * handing out more than this needs.
 *
 * <p><strong>Two queries, one condition.</strong> {@link #findServing} fetches a page and
 * {@link #countServing} counts how many pages there could be, and the {@code WHERE} clause is
 * written out in both. Nothing in the language keeps them in step — a filter added to one and
 * forgotten in the other produces no error at all, just a count that disagrees with the list.
 * {@code BusinessSearchPagingTests} walks every page and compares what it collected against the
 * count, which is what turns that silence into a failing build.
 */
interface BusinessSearchRepository extends Repository<BusinessProfile, UUID> {

	/**
	 * Published businesses whose own service area reaches the given point, nearest first.
	 *
	 * <p><strong>The radius belongs to the row.</strong> This is not "within N miles of the
	 * customer" — every business declares how far it travels, so the test is whether the customer
	 * falls inside <em>its</em> area. That is why V16 stores the area as a shape: a per-row
	 * distance cannot use an index, and a shape containing a point can.
	 *
	 * <p>Profiles with no coordinates have no area and are absent without a clause saying so,
	 * which is the same profile {@code ADDRESS_GEOCODED} refuses to publish.
	 *
	 * <p>The trade filter is a flag and a list rather than an optional list, because a native
	 * {@code IN ()} with nothing in it is not valid SQL. When {@code narrowByTrade} is false the
	 * list is never read — pass anything non-empty — and every business that reaches the point
	 * comes back.
	 *
	 * <p><strong>The name filter needs no such flag,</strong> because a string has an empty value
	 * and a list does not. Blank narrows nothing, which is the same thing an absent parameter
	 * means, so the two never have to be told apart.
	 *
	 * <p>{@code %>} is trigram word similarity, and it is the operator rather than the function on
	 * purpose: only the operator can use the GIN index V17 created for exactly this, and the
	 * function form would read every published row to answer. What it compares is the searched
	 * name against any run of the stored one, so "Okonkwo" finds "Okonkwo Heating & Air" — plain
	 * {@code %} compares the whole of both strings and would score that pair too low to match.
	 *
	 * <p>How close is close enough is PostgreSQL's {@code pg_trgm.word_similarity_threshold}, 0.6
	 * by default. It is left at the default rather than set per query, because setting it means
	 * setting it on the connection and a pooled connection carries that to whoever holds it next.
	 * A deployment that changes the default changes these results, which is what the suite pins.
	 *
	 * <p><strong>The picked job sorts, it does not filter.</strong> {@code offersThisJob} is a
	 * column and never a {@code WHERE} clause, so the set of businesses is the same whether or not
	 * a job was picked — which is what lets {@link #countServing} stay as it is. Filtering to the
	 * ones that list it would be the tidier answer and the emptier one: service lists average
	 * three entries per business, for businesses that do thirty kinds of work, so "does not list
	 * it" covers the plumber who can fix a toilet and never wrote it down.
	 *
	 * <p>The {@code CASE} keeps "nobody asked" apart from "we looked", as the suggestion query
	 * does with availability. With no job picked every row answers null, which orders identically
	 * to how it did before this column existed.
	 *
	 * <p>Ordered by distance, then slug — after the picked job, when there is one. The second is
	 * not decoration, and paging is what made it load-bearing: two businesses at the same
	 * centroid — the common case, since most points are ZIP centroids — would otherwise swap
	 * places between identical calls. Before paging that merely looked untrustworthy. Now it
	 * would put one of them on two pages and the other on none, and nothing downstream could
	 * tell.
	 *
	 * <p>{@code OFFSET} rather than a cursor, and the cap is why. Deep offsets are what make this
	 * form slow — PostgreSQL walks and discards every skipped row — and the largest offset this
	 * can be asked for is the cap minus one page. There is nothing here for a cursor to make
	 * faster, and a cursor would cost the page numbers the URL carries.
	 *
	 * <p>The licence flags are two {@code EXISTS} rather than a join, so a business holding four
	 * licences stays one row. An expired one counts for neither: a badge is a statement about
	 * today.
	 *
	 * <p>The pricing join is {@code LEFT} because pricing is an onboarding step a published
	 * profile need not have reached, and a business without it must still be findable.
	 */
	@Query(value = """
			SELECT b.id              AS id,
			       b.slug            AS slug,
			       b.display_name    AS displayName,
			       b.city            AS city,
			       b.state           AS state,
			       b.time_zone       AS timeZone,
			       t.display_name    AS primaryTrade,
			       pr.hourly_rate    AS hourlyRate,
			       EXISTS (SELECT 1 FROM business_license l
			               WHERE l.business_id = b.id
			                 AND (l.expires_on IS NULL OR l.expires_on >= CURRENT_DATE))
			                         AS licensed,
			       EXISTS (SELECT 1 FROM business_license l
			               WHERE l.business_id = b.id
			                 AND l.verified_at IS NOT NULL
			                 AND (l.expires_on IS NULL OR l.expires_on >= CURRENT_DATE))
			                         AS licenseVerified,
			       ST_Distance(
			           ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
			           ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
			       ) / 1609.344      AS distanceMiles,
			       CASE WHEN :haveService THEN EXISTS (
			           SELECT 1 FROM business_service bs
			           WHERE bs.business_id = b.id
			             AND bs.catalog_id = :catalogId
			             AND bs.active
			             AND bs.deleted_at IS NULL)
			       END               AS offersThisJob
			FROM business_profile b
			LEFT JOIN business_trade bt
			       ON bt.business_id = b.id AND bt.is_primary AND bt.deleted_at IS NULL
			LEFT JOIN trade t ON t.id = bt.trade_id
			LEFT JOIN business_pricing pr ON pr.business_id = b.id
			WHERE b.status = 'PUBLISHED'
			  AND ST_Covers(
			          b.service_area,
			          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography)
			  AND (:narrowByTrade = FALSE OR EXISTS (
			          SELECT 1 FROM business_trade x
			          WHERE x.business_id = b.id
			            AND x.deleted_at IS NULL
			            AND x.trade_id IN (:tradeIds)))
			  AND (:name = '' OR b.display_name %> :name)
			ORDER BY offersThisJob DESC NULLS LAST, distanceMiles ASC, b.slug ASC
			LIMIT :pageSize OFFSET :offset""", nativeQuery = true)
	List<SearchRow> findServing(@Param("latitude") BigDecimal latitude,
			@Param("longitude") BigDecimal longitude,
			@Param("narrowByTrade") boolean narrowByTrade,
			@Param("tradeIds") List<UUID> tradeIds,
			@Param("name") String name,
			@Param("haveService") boolean haveService,
			@Param("catalogId") UUID catalogId,
			@Param("pageSize") int pageSize,
			@Param("offset") int offset);

	/**
	 * How many businesses {@link #findServing} would return in total, counted no further than
	 * {@code ceiling}.
	 *
	 * <p><strong>Why it stops counting.</strong> The answer is a pager and a headline, and neither
	 * changes between "300 matched" and "3000 matched". Counting the true figure means visiting
	 * every matching row on every search to print a number nobody acts on. Passing the cap plus
	 * one instead answers two questions at once: the exact count while it is small, and "more than
	 * the cap" the moment it is not — the caller tells them apart by comparing.
	 *
	 * <p><strong>Why not {@code count(*) OVER ()} on the query above.</strong> It would be one
	 * query instead of two and it would be wrong for the reason that matters: a window function is
	 * evaluated over the whole result set before {@code LIMIT} narrows it, so it counts every
	 * match anyway. The cap would exist and cost exactly what it was meant to save.
	 *
	 * <p><strong>The picked job is missing for the same reason the joins are.</strong> It adds a
	 * column to the query above and no condition, so the set it counts is the same one. Should it
	 * ever become a filter, it belongs here too — and {@code BusinessSearchPagingTests} is what
	 * would notice, because it walks every page and compares the total against what it collected.
	 *
	 * <p><strong>Why the joins are missing.</strong> {@code findServing} joins trade and pricing to
	 * add columns, and both are {@code LEFT} — a left join cannot change which rows match, so
	 * counting without them counts the same set. Should one ever become an inner join, or gain an
	 * {@code ON} condition that filters rather than describes, it belongs here too.
	 */
	@Query(value = """
			SELECT count(*) FROM (
			    SELECT 1
			    FROM business_profile b
			    WHERE b.status = 'PUBLISHED'
			      AND ST_Covers(
			              b.service_area,
			              ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography)
			      AND (:narrowByTrade = FALSE OR EXISTS (
			              SELECT 1 FROM business_trade x
			              WHERE x.business_id = b.id
			                AND x.deleted_at IS NULL
			                AND x.trade_id IN (:tradeIds)))
			      AND (:name = '' OR b.display_name %> :name)
			    LIMIT :ceiling
			) counted""", nativeQuery = true)
	int countServing(@Param("latitude") BigDecimal latitude,
			@Param("longitude") BigDecimal longitude,
			@Param("narrowByTrade") boolean narrowByTrade,
			@Param("tradeIds") List<UUID> tradeIds,
			@Param("name") String name,
			@Param("ceiling") int ceiling);

	/**
	 * One business by the URL it was published under — and only while it is published.
	 *
	 * <p><strong>The status is in the query and not in the caller</strong>, for the reason every
	 * lookup in {@link BusinessProfileRepository} takes an owner: a signature that cannot express
	 * the unpublished case is one nobody can forget to narrow. A draft, a suspension and a slug
	 * nobody holds then come back the same way — as an empty {@link Optional} — which is the one
	 * 404 the contract promises for all three.
	 *
	 * <p>The entity rather than a projection, unlike everything above it. The search reads fifty
	 * businesses to draw eleven columns; this reads one to draw the page about it, and a
	 * projection would be a second list of fields to keep in step with the first.
	 */
	@Query("""
			select b from BusinessProfile b
			where b.slug = :slug
			  and b.status = com.tradeties.business.BusinessStatus.PUBLISHED""")
	Optional<BusinessProfile> findPublishedBySlug(@Param("slug") String slug);

	/**
	 * The shape {@link #findServing} answers in, before it becomes a {@code BusinessSearchResult}.
	 *
	 * <p>The id never reaches the customer; it correlates a row with the slots fetched for it. The
	 * zone does, because {@link NextAvailability} needs it to read a working week stored as a wall
	 * clock and the client needs it to print the result back.
	 */
	interface SearchRow {

		UUID getId();

		String getSlug();

		String getDisplayName();

		String getCity();

		String getState();

		String getTimeZone();

		String getPrimaryTrade();

		double getDistanceMiles();

		BigDecimal getHourlyRate();

		/** Null when no job was picked, and that is not the same as false. */
		Boolean getOffersThisJob();

		boolean getLicensed();

		boolean getLicenseVerified();
	}
}
