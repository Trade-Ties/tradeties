package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.tradeties.business.ServiceDefinition;
import com.tradeties.business.ServiceDetails;
import com.tradeties.business.ServicePricingMode;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * One thing a business offers.
 *
 * <p>Named for what it is rather than after its table, because {@code Service} is both the
 * generated wire type and a Spring stereotype.
 *
 * <p>{@code businessId} and {@code tradeId} are plain columns, not associations. The
 * composite foreign key on {@code (business_id, trade_id)} is what guarantees a service can
 * only sit under a trade the business actually holds; mapping that as a JPA relationship
 * would buy a lazy-loading problem and no extra safety.
 */
@Entity
@Table(name = "business_service")
class ServiceOffering {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	/**
	 * Null means the service spans trades. Also set to null by the database if the business
	 * stops holding that trade — {@code ON DELETE SET NULL} on the composite key, which is
	 * why dropping a trade does not take its services with it.
	 */
	@Column(name = "trade_id")
	private UUID tradeId;

	@Column(name = "name", nullable = false, length = 160)
	private String name;

	@Column(name = "description", length = 2000)
	private String description;

	@Column(name = "estimated_duration_minutes", nullable = false)
	private int estimatedDurationMinutes;

	@Enumerated(EnumType.STRING)
	@Column(name = "pricing_mode", nullable = false, length = 32)
	private ServicePricingMode pricingMode;

	@Column(name = "price", precision = 19, scale = 4)
	private BigDecimal price;

	@Column(name = "active", nullable = false)
	private boolean active;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected ServiceOffering() {
		// for JPA
	}

	ServiceOffering(UUID businessId, ServiceDefinition definition, int sortOrder) {
		this.businessId = businessId;
		this.sortOrder = sortOrder;
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

	/** Unconditional, because the write is a replacement and not a merge. */
	final void apply(ServiceDefinition definition) {
		this.tradeId = definition.tradeId();
		this.name = definition.name();
		this.description = definition.description();
		this.estimatedDurationMinutes = definition.estimatedDurationMinutes();
		this.pricingMode = definition.pricingMode();
		this.price = definition.price();
		this.active = definition.active();
	}

	UUID id() {
		return id;
	}

	boolean isActive() {
		return active;
	}

	long version() {
		return version;
	}

	void moveTo(int sortOrder) {
		this.sortOrder = sortOrder;
	}

	void deactivate() {
		this.active = false;
	}

	ServiceDetails toDetails() {
		return new ServiceDetails(
				id, tradeId, name, description, estimatedDurationMinutes,
				pricingMode, price, active, sortOrder, version);
	}
}
