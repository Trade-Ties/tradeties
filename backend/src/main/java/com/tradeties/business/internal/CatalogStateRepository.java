package com.tradeties.business.internal;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface CatalogStateRepository extends JpaRepository<CatalogState, String> {

	List<CatalogState> findAllByOrderByNameAsc();
}
