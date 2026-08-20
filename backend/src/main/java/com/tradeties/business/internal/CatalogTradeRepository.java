package com.tradeties.business.internal;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface CatalogTradeRepository extends JpaRepository<CatalogTrade, UUID> {

	/**
	 * Inactive trades are never offered. One taken off the market stays in the table because
	 * existing profiles point at it — it just stops being a choice.
	 */
	List<CatalogTrade> findByActiveTrueOrderBySortOrderAsc();
}
