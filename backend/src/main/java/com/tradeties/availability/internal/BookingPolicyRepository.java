package com.tradeties.availability.internal;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface BookingPolicyRepository extends JpaRepository<BookingPolicyRow, UUID> {

	/**
	 * The mutex of the whole calendar. {@code PESSIMISTIC_WRITE} is {@code SELECT … FOR UPDATE},
	 * and every write path that touches working hours, time off or an accepted appointment has to
	 * take this first, so they queue behind each other instead of each being individually valid and
	 * jointly wrong.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from BookingPolicyRow p where p.businessId = :businessId")
	Optional<BookingPolicyRow> lockByBusinessId(@Param("businessId") UUID businessId);
}
