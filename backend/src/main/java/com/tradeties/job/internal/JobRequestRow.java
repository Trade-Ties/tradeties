package com.tradeties.job.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tradeties.business.BookableService;

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

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One job put to one business, for one service, at one start.
 *
 * <p><strong>The snapshot columns are the substance of this row.</strong> The ids say what was
 * meant; the copies say what was agreed. A business that renames its service or raises its
 * cancellation fee tomorrow changes neither, which is the whole reason they are columns here
 * rather than a join away.
 *
 * <p>Three of the six states are reachable: a request arrives {@code PENDING} and the business
 * accepts or declines it. Withdrawal and cancellation are the customer's, and their columns —
 * {@code withdrawn_at}, {@code cancelled_at}, {@code cancelled_by},
 * {@code cancellation_fee_charged}, {@code completed_at} — are deliberately unmapped until
 * something writes them. Mapping a column nothing reads makes this look like the entity it is not,
 * and {@code ddl-auto: validate} only checks the columns named here.
 */
@Entity
@Table(name = "job_request")
class JobRequestRow {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "job_id", nullable = false, updatable = false)
	private UUID jobId;

	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	@Column(name = "service_id", nullable = false, updatable = false)
	private UUID serviceId;

	@Column(name = "starts_at", nullable = false)
	private Instant startsAt;

	@Column(name = "ends_at", nullable = false)
	private Instant endsAt;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 32)
	private RequestStatus status;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "currency", nullable = false, updatable = false, length = 3)
	private String currency;

	@Column(name = "service_name_snapshot", nullable = false, updatable = false, length = 160)
	private String serviceName;

	@Column(name = "estimated_duration_minutes_snapshot", nullable = false, updatable = false)
	private int estimatedDurationMinutes;

	@Column(name = "service_pricing_mode_snapshot", nullable = false, updatable = false, length = 32)
	private String pricingMode;

	@Column(name = "service_price_snapshot", updatable = false)
	private BigDecimal servicePrice;

	@Column(name = "hourly_rate_snapshot", updatable = false)
	private BigDecimal hourlyRate;

	@Column(name = "effective_hourly_rate_snapshot", updatable = false)
	private BigDecimal effectiveHourlyRate;

	@Column(name = "service_call_fee_snapshot", updatable = false)
	private BigDecimal serviceCallFee;

	@Column(name = "cancellation_fee_snapshot", nullable = false, updatable = false)
	private BigDecimal cancellationFee;

	@Column(name = "cancellation_notice_hours_snapshot", nullable = false, updatable = false)
	private int cancellationNoticeHours;

	/** Set with the status, never apart from it — the table's check constraints insist. */
	@Column(name = "decided_at")
	private Instant decidedAt;

	@Column(name = "decline_reason", length = 500)
	private String declineReason;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected JobRequestRow() {
		// for JPA
	}

	/**
	 * The end is computed and never taken from the caller. It is what the overlap check between
	 * accepted appointments is written against, so a client proposing it could propose one that
	 * does not match the duration it was quoted.
	 */
	JobRequestRow(UUID jobId, Instant startsAt, BookableService offered) {
		this.jobId = jobId;
		this.businessId = offered.businessId();
		this.serviceId = offered.serviceId();
		this.startsAt = startsAt;
		this.endsAt = startsAt.plus(offered.estimatedDurationMinutes(), ChronoUnit.MINUTES);
		this.status = RequestStatus.PENDING;

		this.currency = offered.currency();
		this.serviceName = offered.serviceName();
		this.estimatedDurationMinutes = offered.estimatedDurationMinutes();
		this.pricingMode = offered.pricingMode().name();
		this.servicePrice = offered.price();
		this.hourlyRate = offered.hourlyRate();
		this.effectiveHourlyRate = offered.effectiveHourlyRate();
		this.serviceCallFee = offered.serviceCallFee();
		this.cancellationFee = offered.cancellationFee();
		this.cancellationNoticeHours = offered.cancellationNoticeHours();
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

	UUID id() {
		return id;
	}

	UUID jobId() {
		return jobId;
	}

	UUID businessId() {
		return businessId;
	}

	RequestStatus status() {
		return status;
	}

	Instant startsAt() {
		return startsAt;
	}

	Instant endsAt() {
		return endsAt;
	}

	String serviceName() {
		return serviceName;
	}

	int estimatedDurationMinutes() {
		return estimatedDurationMinutes;
	}

	String currency() {
		return currency;
	}

	BigDecimal cancellationFee() {
		return cancellationFee;
	}

	int cancellationNoticeHours() {
		return cancellationNoticeHours;
	}

	BigDecimal servicePrice() {
		return servicePrice;
	}

	BigDecimal effectiveHourlyRate() {
		return effectiveHourlyRate;
	}

	BigDecimal serviceCallFee() {
		return serviceCallFee;
	}

	Instant createdAt() {
		return createdAt;
	}

	Instant decidedAt() {
		return decidedAt;
	}

	String declineReason() {
		return declineReason;
	}

	boolean isPending() {
		return status == RequestStatus.PENDING;
	}

	/**
	 * Both stamps move together, which is what the table's own check constraints insist on: a
	 * status and its timestamp are two renderings of one fact, and a row carrying only one of them
	 * makes a report on turnaround times average over nulls.
	 */
	void accept(Instant when) {
		this.status = RequestStatus.ACCEPTED;
		this.decidedAt = when;
	}

	void decline(Instant when, String reason) {
		this.status = RequestStatus.DECLINED;
		this.decidedAt = when;
		this.declineReason = reason;
	}
}
