package com.tradeties.business.internal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface CatalogTimeZoneRepository extends JpaRepository<CatalogTimeZone, String> {

	/**
	 * By {@code sort_order}, not alphabetically. The seven zones that cover almost every
	 * business come first; alphabetical order would open the select with America/Adak, which
	 * serves about a hundred people.
	 */
	List<CatalogTimeZone> findAllByOrderBySortOrderAsc();
}
