package com.tradeties.business.internal;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Primary and additional trades share a table with a flag rather than living in a column
 * on the profile plus a table beside it: otherwise every "find me all plumbers" query would
 * have to union two places and index both.
 *
 * <p>No timestamps and no version. This is a link row — there is nothing on it that two
 * transactions could meaningfully write at once, and the whole set is replaced as a unit.
 */
@Entity
@Table(name = "business_trade")
class BusinessTradeLink {

	@EmbeddedId
	private BusinessTradeLinkId id;

	/**
	 * At most one per business, enforced by a partial unique index. That it is *exactly* one
	 * when publishing is checked by the publish service — a partial index cannot say that.
	 */
	@Column(name = "is_primary", nullable = false)
	private boolean primary;

	protected BusinessTradeLink() {
		// for JPA
	}

	BusinessTradeLink(UUID businessId, UUID tradeId, boolean primary) {
		this.id = new BusinessTradeLinkId(businessId, tradeId);
		this.primary = primary;
	}

	UUID tradeId() {
		return id.tradeId();
	}

	boolean isPrimary() {
		return primary;
	}

	void markPrimary(boolean primary) {
		this.primary = primary;
	}
}
