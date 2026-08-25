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

import org.hibernate.annotations.SoftDelete;
import org.hibernate.annotations.SoftDeleteType;

/**
 * Named for what it is rather than after its table, because {@code Service} is both the
 * generated wire type and a Spring stereotype.
 *
 * <p>{@code businessId} and {@code tradeId} are plain columns, not associations. The
 * composite foreign key on {@code (business_id, trade_id)} is what guarantees a service can
 * only sit under a trade the business actually holds; mapping that as a JPA relationship
 * would buy a lazy-loading problem and no extra safety.
 *
 * <p><strong>Removal is a stamp, not a delete.</strong> {@code @SoftDelete} makes Hibernate
 * rewrite every {@code delete} as an update of {@code deleted_at} and add
 * {@code deleted_at is null} to every query it builds — so the repository below reads as if
 * the rows were gone, and they are not. That is deliberate over doing it by hand: a service
 * row is the only record that this work was offered under this name at this price, and one
 * forgotten {@code and deletedAt is null} in eight query methods is a catalogue leaking into
 * a list nobody expected it in.
 *
 * <p>Not the same thing as {@code active}. A deactivated service is one the tradesperson has
 * retired and can still see, listed with {@code active: false} so the appointments naming it
 * stay readable. A removed one is gone from every answer. {@code ServiceCatalogService}
 * chooses between them.
 */
@Entity
@Table(name = "business_service")
@SoftDelete(strategy = SoftDeleteType.TIMESTAMP, columnName = "deleted_at")
class ServiceOffering {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	/**
	 * The one trade this service sits under, always one the business holds. Giving that trade
	 * up retires the service with it — see {@code TradeSelectionService.replaceForOwner},
	 * which stamps both rather than leaving a live service under a trade nobody claims.
	 */
	@Column(name = "trade_id", nullable = false)
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
