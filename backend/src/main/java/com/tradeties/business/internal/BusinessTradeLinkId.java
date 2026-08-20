package com.tradeties.business.internal;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
class BusinessTradeLinkId implements Serializable {

	@Column(name = "business_id", nullable = false)
	private UUID businessId;

	@Column(name = "trade_id", nullable = false)
	private UUID tradeId;

	protected BusinessTradeLinkId() {
		// for JPA
	}

	BusinessTradeLinkId(UUID businessId, UUID tradeId) {
		this.businessId = businessId;
		this.tradeId = tradeId;
	}

	UUID tradeId() {
		return tradeId;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		return other instanceof BusinessTradeLinkId that
				&& Objects.equals(businessId, that.businessId)
				&& Objects.equals(tradeId, that.tradeId);
	}

	@Override
	public int hashCode() {
		return Objects.hash(businessId, tradeId);
	}
}
