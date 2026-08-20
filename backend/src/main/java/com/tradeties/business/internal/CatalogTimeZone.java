package com.tradeties.business.internal;

import com.tradeties.business.TimeZoneOption;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Read-only from the application's side — the rows are owned by
 * {@code V5__time_zone_reference.sql}, hence no timestamps and no version column.
 *
 * <p>Named {@code CatalogTimeZone} rather than {@code TimeZone} because the short name is taken by
 * {@code java.util.TimeZone}, and an accidental import of the wrong one compiles.
 */
@Entity
@Table(name = "time_zone")
class CatalogTimeZone {

	@Id
	@Column(name = "code", nullable = false, length = 64)
	private String code;

	@Column(name = "display_name", nullable = false, length = 80)
	private String displayName;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	protected CatalogTimeZone() {
		// for JPA
	}

	String code() {
		return code;
	}

	TimeZoneOption toOption() {
		return new TimeZoneOption(code, displayName);
	}
}
