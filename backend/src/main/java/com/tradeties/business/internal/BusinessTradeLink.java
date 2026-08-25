package com.tradeties.business.internal;

import java.time.Instant;
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
 * <p>No version. This is a link row — there is nothing on it that two transactions could
 * meaningfully write at once, and the whole set is replaced as a unit.
 *
 * <p><strong>Giving a trade up retires the row, it does not remove it.</strong> The services
 * filed under it point here through a composite foreign key, and destroying the link would destroy
 * them with it.
 *
 * <p>Stamped by hand rather than through {@code @SoftDelete}, which is what
 * {@link ServiceOffering} uses. That annotation adds {@code deleted_at is null} to every
 * query unconditionally — and a retired link is meant to be found again: re-ticking a trade
 * revives the row that is already there, because the primary key is
 * {@code (business_id, trade_id)} and inserting a second one is not available. The filter
 * that helps a service catalogue would hide exactly the row this table needs to reach.
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

	@Column(name = "deleted_at")
	private Instant deletedAt;

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

	boolean isRetired() {
		return deletedAt != null;
	}

	/**
	 * The primary flag goes with it. It is a claim about the trades a business leads with, and a
	 * trade it no longer holds makes no claim — the partial unique index counts only live rows,
	 * so leaving the flag set would not break anything, and reading one back off a retired row
	 * later would be reading history as if it were current.
	 */
	void retire(Instant when) {
		this.deletedAt = when;
		this.primary = false;
	}

	void restore(boolean primary) {
		this.deletedAt = null;
		this.primary = primary;
	}
}
