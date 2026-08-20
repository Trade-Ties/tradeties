package com.tradeties.business;

import java.math.BigDecimal;

/**
 * The two values travel together and are never apart: a half-located business would disappear
 * from every radius search without anything looking broken. The database says the same with
 * {@code CHECK ((latitude IS NULL) = (longitude IS NULL))}.
 *
 * <p>{@link BigDecimal} rather than {@code double}, to match {@code NUMERIC(9,6)} — the column,
 * not the JVM, decides how many decimals survive.
 */
public record GeoPoint(BigDecimal latitude, BigDecimal longitude) {

	public GeoPoint {
		if (latitude == null || longitude == null) {
			throw new IllegalArgumentException("A GeoPoint needs both coordinates or must not exist at all");
		}
	}
}
