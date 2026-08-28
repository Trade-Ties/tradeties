package com.tradeties.business.internal;

import java.math.BigDecimal;

import com.tradeties.business.GeoPoint;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Where a ZIP code sits.
 *
 * <p>The natural key is the primary key, as in {@link CatalogState}: a ZIP is stable, unique and
 * already the value {@code business_profile.postal_code} stores, so a surrogate would cost a join
 * on every lookup.
 *
 * <p>Seeded from a repeatable migration rather than a versioned one, unlike {@code us_state}: the
 * Census publishes a new vintage of the underlying dataset every year.
 */
@Entity
@Table(name = "zip_centroid")
class CatalogZip {

	@Id
	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "zip", nullable = false, length = 5)
	private String zip;

	@Column(name = "latitude", nullable = false, precision = 9, scale = 6)
	private BigDecimal latitude;

	@Column(name = "longitude", nullable = false, precision = 9, scale = 6)
	private BigDecimal longitude;

	protected CatalogZip() {
		// for JPA
	}

	GeoPoint toPoint() {
		return new GeoPoint(latitude, longitude);
	}
}
