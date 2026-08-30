package com.tradeties.availability.internal;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface WorkingHoursRepository extends JpaRepository<WorkingHoursRow, UUID> {

	List<WorkingHoursRow> findByBusinessId(UUID businessId);

	/**
	 * The same rows for a whole page of businesses. One query rather than one per row, because the
	 * customer search asks about every result it is about to draw.
	 */
	List<WorkingHoursRow> findByBusinessIdIn(Collection<UUID> businessIds);

	/**
	 * Whether the week is set at all, which is all the publish checklist asks. Counted in the
	 * database rather than by loading the rows and measuring the list: the checklist is evaluated
	 * twice per trade selection and again on every publish.
	 */
	boolean existsByBusinessId(UUID businessId);

	void deleteByBusinessId(UUID businessId);
}
