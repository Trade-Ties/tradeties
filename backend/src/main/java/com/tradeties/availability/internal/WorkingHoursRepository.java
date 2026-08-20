package com.tradeties.availability.internal;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface WorkingHoursRepository extends JpaRepository<WorkingHoursRow, UUID> {

	List<WorkingHoursRow> findByBusinessId(UUID businessId);

	void deleteByBusinessId(UUID businessId);
}
