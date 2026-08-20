package com.tradeties.business.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ServiceOfferingRepository extends JpaRepository<ServiceOffering, UUID> {

	/**
	 * {@code created_at} is the tiebreaker, and it is not decoration. Nothing in the schema makes
	 * {@code sort_order} unique, so two services can share a position, and ordering by it alone
	 * leaves those pairs to PostgreSQL — which is free to return them differently after an update or
	 * a vacuum. A list that reshuffles itself with nobody touching it is the hardest kind of report
	 * to act on.
	 */
	List<ServiceOffering> findByBusinessIdOrderBySortOrderAscCreatedAtAsc(UUID businessId);

	List<ServiceOffering> findByBusinessIdAndActiveTrueOrderBySortOrderAscCreatedAtAsc(UUID businessId);

	/**
	 * The id alone would be enough to find the row — taking the business too is what makes
	 * someone else's service indistinguishable from a missing one, without anybody having to
	 * remember an ownership check.
	 */
	Optional<ServiceOffering> findByIdAndBusinessId(UUID id, UUID businessId);

	/**
	 * Removal asks {@link com.tradeties.business.ServiceUsage} whether anything points at
	 * the service and then acts on the answer. Without a lock the answer can go stale between
	 * the two: a request naming this service arrives in the gap, the delete goes ahead, and the
	 * foreign key refuses it — back in the aborted transaction the whole design exists to
	 * avoid.
	 *
	 * <p>{@code PESSIMISTIC_WRITE} is {@code SELECT … FOR UPDATE} and closes that gap precisely:
	 * PostgreSQL takes {@code FOR KEY SHARE} on a row an incoming foreign key references, and the
	 * two conflict.
	 *
	 * <p>Today it waits for nothing, because nothing references a service yet.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from ServiceOffering s where s.id = :id and s.businessId = :businessId")
	Optional<ServiceOffering> lockByIdAndBusinessId(@Param("id") UUID id, @Param("businessId") UUID businessId);

	/** Mirrors the unique index on {@code (business_id, lower(name))}. */
	boolean existsByBusinessIdAndNameIgnoreCase(UUID businessId, String name);

	boolean existsByBusinessIdAndNameIgnoreCaseAndIdNot(UUID businessId, String name, UUID id);

	/**
	 * Where the last service sits — deliberately not how many there are. The count is wrong as soon
	 * as anything has been deleted: three services at 10, 20 and 30 with the middle one gone leave a
	 * count of two, which hands the newcomer 30 a second time, and two deletions file it in front of
	 * the one at 30, against the contract's "appended to the end of the list".
	 *
	 * <p>{@code coalesce} covers the empty catalogue, where {@code max} over no rows is null.
	 */
	@Query("select coalesce(max(s.sortOrder), 0) from ServiceOffering s where s.businessId = :businessId")
	int highestSortOrder(@Param("businessId") UUID businessId);
}
