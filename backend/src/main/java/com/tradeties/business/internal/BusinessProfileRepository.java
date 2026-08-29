package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Note what is missing: there is no {@code findById}-plus-ownership-check anywhere in this
 * module. Every lookup takes the owner, so forgetting the check is not something a future author
 * can do — the signature will not let them (GENERAL_DATAMODEL, "queries with the owner, not a
 * check afterwards").
 */
interface BusinessProfileRepository extends JpaRepository<BusinessProfile, UUID> {

	Optional<BusinessProfile> findByOwnerUserId(UUID ownerUserId);

	boolean existsByOwnerUserId(UUID ownerUserId);

	boolean existsBySlug(String slug);

	boolean existsBySlugAndOwnerUserIdNot(String slug, UUID ownerUserId);

	/**
	 * Moves the wizard's marker forward, and only forward.
	 *
	 * <p><strong>A bulk update rather than a mutation on the entity, and that is the whole point of
	 * it.</strong> {@code business_profile} carries {@code @Version}, so bumping the step through the
	 * entity would increment it and invalidate the profile version the wizard has been holding since
	 * step 2. {@code @PreUpdate} not firing leaves {@code updated_at} alone for the same reason: the
	 * marker is a note about where somebody is in a form, not content of the profile.
	 *
	 * <p>The {@code <} in the where clause is the monotonicity, without a read-modify-write.
	 *
	 * <p>Bulk updates bypass the persistence context, so a {@code BusinessProfile} already loaded in
	 * this transaction keeps the old value in memory. Every caller runs this as its last statement
	 * and none answers with the profile; a caller that ever does has to re-read.
	 */
	@Modifying(flushAutomatically = true)
	@Query("""
			update BusinessProfile b set b.onboardingCompletedStep = :step
			where b.id = :businessId and b.onboardingCompletedStep < :step""")
	void advanceOnboardingStep(@Param("businessId") UUID businessId, @Param("step") short step);

	/**
	 * The work list for the address-level geocoder: profiles no better placed than their ZIP
	 * centroid that have not been asked about recently.
	 *
	 * <p><strong>A null precision is in the list, and that is the case that matters most.</strong>
	 * It means the postal code resolved to nothing at all — a ZIP with no ZCTA, a PO-box-only
	 * range — so the profile has no point, is in no radius search, and {@code ADDRESS_GEOCODED}
	 * refuses to let it go live. The address-level service is the only thing that can still place
	 * it, because it reads the street and not just the five digits. Taking only {@code ZIP} here
	 * would exclude precisely the profiles with no other way out, and leave their owners a refusal
	 * naming a postal code that is perfectly correct and no action that could fix it.
	 *
	 * <p>No owner in the signature, which is the one exception to the rule above and is not a hole
	 * in it. That rule protects a caller acting <em>for</em> somebody; this query has no caller and
	 * no requester, it is a background pass over the whole table, and there is no owner it could
	 * take. It answers with ids and addresses and nothing that identifies a person.
	 *
	 * <p>Ordered oldest-attempt-first, nulls first, so a profile never looked at goes before one
	 * being retried and no profile can be starved by a steady trickle of new ones.
	 */
	@Query("""
			select b from BusinessProfile b
			where (b.geocodePrecision is null
			       or b.geocodePrecision = com.tradeties.business.internal.GeocodePrecision.ZIP)
			  and (b.geocodeAttemptedAt is null or b.geocodeAttemptedAt < :notSince)
			order by b.geocodeAttemptedAt asc nulls first""")
	List<BusinessProfile> findAwaitingPreciseGeocode(@Param("notSince") Instant notSince, Limit limit);

	/**
	 * Records what the pass found, or that it found nothing.
	 *
	 * <p><strong>A bulk update for the same reason {@link #advanceOnboardingStep} is one</strong>,
	 * and here it matters more: this runs on its own schedule, so going through the entity would
	 * bump {@code @Version} underneath whichever tradesperson happens to have the wizard open and
	 * refuse their next save as a conflict with nobody. {@code updated_at} would move too, telling
	 * every owner their profile was edited on a day nobody touched it.
	 *
	 * <p>The coordinates and the precision move together or not at all — pass nulls for all three
	 * to record only the attempt. {@code geocodeAttemptedAt} is written either way, which is what
	 * keeps an address the service cannot match from being asked about on every pass.
	 *
	 * <p><strong>The version in the where clause is what makes this safe against a concurrent
	 * save.</strong> The point being written was fetched for the address this row had when the
	 * pass read it, and an owner who saves during that call may have replaced it — a request to
	 * somebody else's service takes as long as it takes. Guarding on the precision, as this once
	 * did, cannot catch that: a save <em>resets</em> the precision, so the clause would match and
	 * the stale point would land. {@code version} is bumped by a save and by nothing else here,
	 * which makes it the one column that answers "is this still the row I read".
	 *
	 * <p>Bumping it is what must not happen, and a bulk update is what stops that: writing through
	 * the entity would increment the version underneath whoever has the wizard open. So it is read
	 * in the guard and left alone in the set.
	 *
	 * <p>The precision clause stays for a different job — it matches the work list above, so a row
	 * another pass has already sharpened is not written back down to a coarser answer.
	 *
	 * @return the number of rows written, which is zero when the guard rejects. The caller reads
	 *         it: a discarded write that is reported as a success is a race nobody can see
	 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("""
			update BusinessProfile b
			set b.geocodeAttemptedAt = :attemptedAt,
			    b.latitude = coalesce(:latitude, b.latitude),
			    b.longitude = coalesce(:longitude, b.longitude),
			    b.geocodePrecision = coalesce(:precision, b.geocodePrecision)
			where b.id = :businessId
			  and b.version = :version
			  and (b.geocodePrecision is null
			       or b.geocodePrecision = com.tradeties.business.internal.GeocodePrecision.ZIP)""")
	int recordGeocodeAttempt(@Param("businessId") UUID businessId,
			@Param("version") long version,
			@Param("attemptedAt") Instant attemptedAt,
			@Param("latitude") BigDecimal latitude,
			@Param("longitude") BigDecimal longitude,
			@Param("precision") GeocodePrecision precision);
}
