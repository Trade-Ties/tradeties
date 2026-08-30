package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

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
	 * <p>Ordered by distance, then slug. The second is not decoration: two businesses at the same
	 * centroid — the common case, since most points are ZIP centroids — would otherwise swap
	 * places between identical calls, which is what makes a list look untrustworthy.
	 */
	@Query(value = """
			SELECT b.slug            AS slug,
			       b.display_name    AS displayName,
			       b.city            AS city,
			       b.state           AS state,
			       t.display_name    AS primaryTrade,
			       ST_Distance(
			           ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
			           ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
			       ) / 1609.344      AS distanceMiles
			FROM business_profile b
			LEFT JOIN business_trade bt
			       ON bt.business_id = b.id AND bt.is_primary AND bt.deleted_at IS NULL
			LEFT JOIN trade t ON t.id = bt.trade_id
			WHERE b.status = 'PUBLISHED'
			  AND ST_Covers(
			          b.service_area,
			          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography)
			  AND (:narrowByTrade = FALSE OR EXISTS (
			          SELECT 1 FROM business_trade x
			          WHERE x.business_id = b.id
			            AND x.deleted_at IS NULL
			            AND x.trade_id IN (:tradeIds)))
			ORDER BY distanceMiles ASC, b.slug ASC
			LIMIT :limit""", nativeQuery = true)
	List<SearchRow> findServing(@Param("latitude") BigDecimal latitude,
			@Param("longitude") BigDecimal longitude,
			@Param("narrowByTrade") boolean narrowByTrade,
			@Param("tradeIds") List<UUID> tradeIds,
			@Param("limit") int limit);

	/** The shape {@link #findServing} answers in, before it becomes a {@code BusinessSearchResult}. */
	interface SearchRow {

		String getSlug();

		String getDisplayName();

		String getCity();

		String getState();

		String getPrimaryTrade();

		double getDistanceMiles();
	}
}
