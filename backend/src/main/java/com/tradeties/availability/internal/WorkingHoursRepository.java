package com.tradeties.availability.internal;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface WorkingHoursRepository extends JpaRepository<WorkingHoursRow, UUID> {

	List<WorkingHoursRow> findByBusinessId(UUID businessId);

	/**
	 * Whether the week is set at all, which is all the publish checklist asks. Counted in the
	 * database rather than by loading the rows and measuring the list: the checklist is evaluated
	 * twice per trade selection and again on every publish.
	 */
	boolean existsByBusinessId(UUID businessId);

	void deleteByBusinessId(UUID businessId);
}
