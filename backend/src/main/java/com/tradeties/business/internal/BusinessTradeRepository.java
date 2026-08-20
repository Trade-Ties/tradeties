package com.tradeties.business.internal;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface BusinessTradeRepository extends JpaRepository<BusinessTradeLink, BusinessTradeLinkId> {

	List<BusinessTradeLink> findByIdBusinessId(UUID businessId);

	boolean existsByIdBusinessIdAndIdTradeId(UUID businessId, UUID tradeId);

	/**
	 * The partial unique index guarantees this is 0 or 1. Publishing needs it to be exactly
	 * 1, which no index can say.
	 */
	long countByIdBusinessIdAndPrimaryIsTrue(UUID businessId);
}
