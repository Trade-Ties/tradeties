package com.tradeties.availability.internal;

import java.time.Instant;
import java.util.UUID;

import com.tradeties.availability.BookingRules;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * The booking rules of one business — and the lock every calendar write takes.
 *
 * <p>The second job is the one invisible in the columns. The exclusion constraint only catches
 * two accepted appointments genuinely overlapping; it does not catch an appointment accepted
 * while time off is entered over the same period, or that weekday's hours are shortened. All of
 * those serialise on this row with {@code SELECT … FOR UPDATE} — always, even when
 * {@code maxAcceptedAppointmentsPerDay} is null, because otherwise correctness would depend on a
 * configuration option.
 *
 * <p>Two of the four write paths exist today. Accepting a request and entering time off arrive
 * with the {@code job} module and have to take the same lock; a rule that holds for three paths
 * out of four is worse than no rule.
 *
 * <p>The row provisions itself on first use rather than being created with the profile, which is
 * what keeps {@code business} unaware of this module.
 */
@Entity
@Table(name = "availability_booking_policy")
class BookingPolicyRow {

	@Id
	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	@Column(name = "booking_horizon_days", nullable = false)
	private int bookingHorizonDays;

	@Column(name = "min_lead_time_hours", nullable = false)
	private int minLeadTimeHours;

	@Column(name = "max_accepted_appointments_per_day")
	private Integer maxAcceptedAppointmentsPerDay;

	@Column(name = "slot_granularity_minutes", nullable = false)
	private int slotGranularityMinutes;

	@Column(name = "appointment_buffer_minutes", nullable = false)
	private int appointmentBufferMinutes;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected BookingPolicyRow() {
		// for JPA
	}

	BookingPolicyRow(UUID businessId) {
		this.businessId = businessId;

		BookingRules defaults = BookingRules.defaults();
		this.bookingHorizonDays = defaults.bookingHorizonDays();
		this.minLeadTimeHours = defaults.minLeadTimeHours();
		this.maxAcceptedAppointmentsPerDay = defaults.maxAcceptedAppointmentsPerDay();
		this.slotGranularityMinutes = defaults.slotGranularityMinutes();
		this.appointmentBufferMinutes = defaults.appointmentBufferMinutes();
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

	void apply(BookingRules rules) {
		this.bookingHorizonDays = rules.bookingHorizonDays();
		this.minLeadTimeHours = rules.minLeadTimeHours();
		this.maxAcceptedAppointmentsPerDay = rules.maxAcceptedAppointmentsPerDay();
		this.slotGranularityMinutes = rules.slotGranularityMinutes();
		this.appointmentBufferMinutes = rules.appointmentBufferMinutes();
	}

	UUID businessId() {
		return businessId;
	}

	long version() {
		return version;
	}

	BookingRules toRules() {
		return new BookingRules(
				bookingHorizonDays, minLeadTimeHours, maxAcceptedAppointmentsPerDay,
				slotGranularityMinutes, appointmentBufferMinutes, version);
	}
}
