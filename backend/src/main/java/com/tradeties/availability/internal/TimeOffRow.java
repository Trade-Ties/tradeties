package com.tradeties.availability.internal;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * A stretch a business has taken off its own calendar — whole days away, or a few hours.
 *
 * <p>{@code reason} is the business's own note and never leaves the {@code /me/business} side: a
 * customer may see that time is taken, never why.
 */
@Entity
@Table(name = "availability_time_off")
class TimeOffRow {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	@Column(name = "starts_at", nullable = false)
	private Instant startsAt;

	@Column(name = "ends_at", nullable = false)
	private Instant endsAt;

	@Column(name = "all_day", nullable = false)
	private boolean allDay;

	@Column(name = "reason", length = 200)
	private String reason;

	/** The person, not the business — it stays meaningful once a business has several logins. */
	@Column(name = "created_by_user_id", nullable = false, updatable = false)
	private UUID createdByUserId;

	/** Set when an accepted appointment was in the way and the entry was saved over it anyway. */
	@Column(name = "conflict_override_confirmed_at")
	private Instant conflictOverrideConfirmedAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected TimeOffRow() {
		// for JPA
	}

	TimeOffRow(UUID businessId, UUID createdByUserId) {
		this.businessId = businessId;
		this.createdByUserId = createdByUserId;
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

	void cover(Instant startsAt, Instant endsAt, boolean allDay, String reason) {
		this.startsAt = startsAt;
		this.endsAt = endsAt;
		this.allDay = allDay;
		this.reason = reason;
	}

	/** Kept once set: an edit does not unsay that somebody was warned and confirmed. */
	void confirmOverride(Instant when) {
		if (conflictOverrideConfirmedAt == null) {
			conflictOverrideConfirmedAt = when;
		}
	}

	UUID id() {
		return id;
	}

	UUID businessId() {
		return businessId;
	}

	Instant startsAt() {
		return startsAt;
	}

	Instant endsAt() {
		return endsAt;
	}

	boolean allDay() {
		return allDay;
	}

	String reason() {
		return reason;
	}

	long version() {
		return version;
	}
}
