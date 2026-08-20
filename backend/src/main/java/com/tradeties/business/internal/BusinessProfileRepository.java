package com.tradeties.business.internal;

import java.util.Optional;
import java.util.UUID;

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
}
