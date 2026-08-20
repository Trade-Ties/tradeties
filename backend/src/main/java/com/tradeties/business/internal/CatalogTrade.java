package com.tradeties.business.internal;

import java.util.UUID;

import com.tradeties.business.TradeOption;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Named for what it is rather than after its table, because {@code Trade} is also the name of
 * the generated wire type and the two would collide in every file that maps between them.
 *
 * <p>Read-only from the application's side: the rows are owned by
 * {@code R__trade_reference_data.sql} and change by editing that file, hence no timestamps and no
 * version column.
 */
@Entity
@Table(name = "trade")
class CatalogTrade {

	@Id
	@Column(name = "id", nullable = false)
	private UUID id;

	@Column(name = "code", nullable = false, length = 64)
	private String code;

	@Column(name = "display_name", nullable = false, length = 120)
	private String displayName;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Column(name = "active", nullable = false)
	private boolean active;

	protected CatalogTrade() {
		// for JPA
	}

	UUID id() {
		return id;
	}

	boolean isActive() {
		return active;
	}

	TradeOption toOption() {
		return new TradeOption(id, code, displayName);
	}
}
