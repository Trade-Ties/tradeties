package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.tradeties.business.NextAvailability;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * The one query the customer side asks, kept apart from {@link BusinessProfileRepository} because
 * it is a different question. Everything there takes an owner and answers about one profile; this
 * takes no owner, reads across the whole table, and answers with what a stranger may see.
 *
 * <p>A bare {@link Repository} rather than a {@code JpaRepository}: there is nothing to save here
 * and no id to load by, and inheriting twenty write methods onto the anonymous read path would be
 * handing out more than this needs.
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
	 * <p>Ordered by distance, then slug. The second is not decoration: two businesses at the same
	 * centroid — the common case, since most points are ZIP centroids — would otherwise swap
	 * places between identical calls, which is what makes a list look untrustworthy.
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
			       ) / 1609.344      AS distanceMiles
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
			ORDER BY distanceMiles ASC, b.slug ASC
			LIMIT :limit""", nativeQuery = true)
	List<SearchRow> findServing(@Param("latitude") BigDecimal latitude,
			@Param("longitude") BigDecimal longitude,
			@Param("narrowByTrade") boolean narrowByTrade,
			@Param("tradeIds") List<UUID> tradeIds,
			@Param("name") String name,
			@Param("limit") int limit);

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

		boolean getLicensed();

		boolean getLicenseVerified();
	}
}
