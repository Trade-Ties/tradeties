package com.tradeties.business.internal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface BusinessLicenseRepository extends JpaRepository<BusinessLicense, UUID> {

	List<BusinessLicense> findByBusinessId(UUID businessId);

	Optional<BusinessLicense> findByIdAndBusinessId(UUID id, UUID businessId);

	/** Mirrors the unique index that makes state plus number the real-world identity. */
	boolean existsByBusinessIdAndStateAndLicenseNumber(UUID businessId, String state, String licenseNumber);

	boolean existsByBusinessIdAndStateAndLicenseNumberAndIdNot(
			UUID businessId, String state, String licenseNumber, UUID id);
}
