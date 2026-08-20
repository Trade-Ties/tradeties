package com.tradeties.business.internal;

import com.tradeties.business.StateOption;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * The natural key is the primary key: a USPS code is stable, unique and already the value every
 * other table stores, so a surrogate would cost a join on every address.
 *
 * <p>Seeded in {@code V3__business_profile.sql} rather than in a repeatable migration — the set of
 * US states does not grow with market demand.
 */
@Entity
@Table(name = "us_state")
class CatalogState {

	@Id
	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "code", nullable = false, length = 2)
	private String code;

	@Column(name = "name", nullable = false, length = 64)
	private String name;

	protected CatalogState() {
		// for JPA
	}

	StateOption toOption() {
		return new StateOption(code, name);
	}
}
