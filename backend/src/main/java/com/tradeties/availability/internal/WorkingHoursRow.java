package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.util.UUID;

import com.tradeties.availability.HoursBlock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One block of one weekday.
 *
 * <p>{@code dayOfWeek} is a {@code SMALLINT} following ISO-8601, which is exactly what
 * {@link DayOfWeek#getValue()} returns.
 *
 * <p>No timestamps and no version: the week is replaced as a unit, so there is nothing here two
 * transactions could write at once, and the booking policy row is the lock that covers this
 * table.
 */
@Entity
@Table(name = "availability_working_hours")
class WorkingHoursRow {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	@Column(name = "day_of_week", nullable = false)
	private short dayOfWeek;

	@Column(name = "starts_at", nullable = false)
	private short startsAt;

	@Column(name = "ends_at", nullable = false)
	private short endsAt;

	protected WorkingHoursRow() {
		// for JPA
	}

	WorkingHoursRow(UUID businessId, DayOfWeek day, HoursBlock block) {
		this.businessId = businessId;
		this.dayOfWeek = (short) day.getValue();
		this.startsAt = (short) block.startsAtMinutes();
		this.endsAt = (short) block.endsAtMinutes();
	}

	DayOfWeek day() {
		return DayOfWeek.of(dayOfWeek);
	}

	HoursBlock toBlock() {
		return new HoursBlock(startsAt, endsAt);
	}
}
