package com.tradeties.availability.internal;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A stretch a business has declared itself away for.
 *
 * <p>Four of the table's columns, not all of them, and read-only. Nothing in this application
 * writes time off yet — the writer arrives with {@code job} and will need the reason, the author
 * and the override flag that are deliberately absent here. Mapping only what is read keeps this
 * from looking like the writable entity it is not, and {@code ddl-auto: validate} checks that the
 * columns named here exist without asking about the ones that are not.
 */
@Entity
@Table(name = "availability_time_off")
class TimeOffRow {

	@Id
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	@Column(name = "starts_at", nullable = false)
	private Instant startsAt;

	@Column(name = "ends_at", nullable = false)
	private Instant endsAt;

	protected TimeOffRow() {
		// for JPA
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
}
