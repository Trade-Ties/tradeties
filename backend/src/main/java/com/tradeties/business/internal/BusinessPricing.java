package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.tradeties.business.MaterialPricingMode;
import com.tradeties.business.PricingDefinition;
import com.tradeties.business.PricingTerms;
import com.tradeties.business.TravelFeeMode;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Its own table rather than columns on the profile, because this block is what a request
 * snapshots when it is sent: it is read on every enquiry and changes on a different rhythm than
 * the profile does.
 *
 * <p>Created in onboarding step 5, not with the profile. {@code travelFeeMode} and
 * {@code materialPricingMode} have no defensible default, and a row asserting "travel included,
 * material included" would be a statement about money that nobody made.
 */
@Entity
@Table(name = "business_pricing")
class BusinessPricing {

	private static final String DEFAULT_CURRENCY = "USD";

	@Id
	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "currency", nullable = false, length = 3)
	private String currency;

	@Column(name = "hourly_rate", precision = 19, scale = 4)
	private BigDecimal hourlyRate;

	@Column(name = "minimum_billable_minutes", nullable = false)
	private int minimumBillableMinutes;

	@Column(name = "billing_increment_minutes", nullable = false)
	private int billingIncrementMinutes;

	@Column(name = "service_call_fee", precision = 19, scale = 4)
	private BigDecimal serviceCallFee;

	@Column(name = "service_call_fee_waived_if_hired", nullable = false)
	private boolean serviceCallFeeWaivedIfHired;

	@Enumerated(EnumType.STRING)
	@Column(name = "travel_fee_mode", nullable = false, length = 32)
	private TravelFeeMode travelFeeMode;

	@Column(name = "travel_flat_fee", precision = 19, scale = 4)
	private BigDecimal travelFlatFee;

	@Column(name = "travel_rate_per_mile", precision = 19, scale = 4)
	private BigDecimal travelRatePerMile;

	@Column(name = "free_travel_radius_miles")
	private Integer freeTravelRadiusMiles;

	@Enumerated(EnumType.STRING)
	@Column(name = "material_pricing_mode", nullable = false, length = 32)
	private MaterialPricingMode materialPricingMode;

	@Column(name = "material_markup_percent", precision = 5, scale = 2)
	private BigDecimal materialMarkupPercent;

	@Column(name = "cancellation_fee", nullable = false, precision = 19, scale = 4)
	private BigDecimal cancellationFee;

	@Column(name = "cancellation_notice_hours", nullable = false)
	private int cancellationNoticeHours;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected BusinessPricing() {
		// for JPA
	}

	BusinessPricing(UUID businessId, PricingDefinition definition) {
		this.businessId = businessId;
		this.currency = DEFAULT_CURRENCY;
		apply(definition);
	}

	@PrePersist
	void stampCreation() {
		Instant now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	@PreUpdate
	void stampUpdate() {
		this.updatedAt = Instant.now();
	}

	/**
	 * Sets everything unconditionally, which is what makes a mode switch safe: leaving out the flat
	 * fee after moving to {@code PER_MILE} clears it, rather than leaving it behind for the database
	 * to reject.
	 */
	final void apply(PricingDefinition definition) {
		this.hourlyRate = definition.hourlyRate();
		this.minimumBillableMinutes = definition.minimumBillableMinutes();
		this.billingIncrementMinutes = definition.billingIncrementMinutes();
		this.serviceCallFee = definition.serviceCallFee();
		this.serviceCallFeeWaivedIfHired = definition.serviceCallFeeWaivedIfHired();
		this.travelFeeMode = definition.travelFeeMode();
		this.travelFlatFee = definition.travelFlatFee();
		this.travelRatePerMile = definition.travelRatePerMile();
		this.freeTravelRadiusMiles = definition.freeTravelRadiusMiles();
		this.materialPricingMode = definition.materialPricingMode();
		this.materialMarkupPercent = definition.materialMarkupPercent();
		this.cancellationFee = definition.cancellationFee();
		this.cancellationNoticeHours = definition.cancellationNoticeHours();
	}

	long version() {
		return version;
	}

	boolean hasHourlyRate() {
		return hourlyRate != null;
	}

	PricingTerms toTerms() {
		return new PricingTerms(
				currency, hourlyRate, minimumBillableMinutes, billingIncrementMinutes,
				serviceCallFee, serviceCallFeeWaivedIfHired,
				travelFeeMode, travelFlatFee, travelRatePerMile, freeTravelRadiusMiles,
				materialPricingMode, materialMarkupPercent,
				cancellationFee, cancellationNoticeHours, version);
	}
}
