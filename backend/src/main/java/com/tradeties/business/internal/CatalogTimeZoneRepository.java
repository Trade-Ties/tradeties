package com.tradeties.business.internal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface CatalogTimeZoneRepository extends JpaRepository<CatalogTimeZone, String> {

	/**
	 * By {@code sort_order}, not alphabetically: the select runs east to west, the way the
	 * zones are named. Alphabetical order would open it with Alaska.
	 */
	List<CatalogTimeZone> findAllByOrderBySortOrderAsc();
}
