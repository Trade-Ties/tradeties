package com.tradeties.business.internal;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Lookup by ZIP only, which {@code findById} already is — the table answers one question and has
 * no second access path.
 */
interface CatalogZipRepository extends JpaRepository<CatalogZip, String> {
}
