package com.tradeties.job.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import com.tradeties.business.BookableService;
import com.tradeties.job.BookingParty;

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
 * <p>A customer's request arrives {@code PENDING} and the business accepts or declines it; an
 * appointment the business books itself is {@code ACCEPTED} from the start. Either kind, once
 * accepted, can be moved or cancelled by the business. {@code withdrawn_at} and {@code completed_at} stay unmapped until something writes them —
 * mapping a column nothing reads makes this look like the entity it is not.
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

	@Enumerated(EnumType.STRING)
	@Column(name = "booked_by", nullable = false, updatable = false, length = 16)
	private BookingParty bookedBy;

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

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	/** When the business took the conversation out of its inbox, or null while it is there. */
	@Column(name = "inbox_hidden_at")
	private Instant inboxHiddenAt;

	@Enumerated(EnumType.STRING)
	@Column(name = "cancelled_by", length = 16)
	private BookingParty cancelledBy;

	@Column(name = "cancellation_fee_charged")
	private BigDecimal cancellationFeeCharged;

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
	 * A customer's request. The end is computed and never taken from the caller: it is what the
	 * overlap check between accepted appointments is written against, so a customer proposing it
	 * could propose one that does not match the duration they were quoted.
	 */
	JobRequestRow(UUID jobId, Instant startsAt, BookableService offered) {
		this(jobId, startsAt, startsAt.plus(offered.estimatedDurationMinutes(), ChronoUnit.MINUTES), offered);
		this.status = RequestStatus.PENDING;
		this.bookedBy = BookingParty.CUSTOMER;
	}

	/** An appointment the business chose the time of itself, so the end is its choice too. */
	static JobRequestRow bookedByBusiness(UUID jobId, Instant startsAt, Instant endsAt, BookableService offered,
			Instant now) {

		JobRequestRow row = new JobRequestRow(jobId, startsAt, endsAt, offered);
		row.status = RequestStatus.ACCEPTED;
		row.bookedBy = BookingParty.BUSINESS;
		row.decidedAt = now;
		return row;
	}

	private JobRequestRow(UUID jobId, Instant startsAt, Instant endsAt, BookableService offered) {
		this.jobId = jobId;
		this.businessId = offered.businessId();
		this.serviceId = offered.serviceId();
		this.startsAt = startsAt;
		this.endsAt = endsAt;

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

	UUID serviceId() {
		return serviceId;
	}

	BookingParty bookedBy() {
		return bookedBy;
	}

	boolean isPending() {
		return status == RequestStatus.PENDING;
	}

	boolean isAccepted() {
		return status == RequestStatus.ACCEPTED;
	}

	void reschedule(Instant startsAt, Instant endsAt) {
		this.startsAt = startsAt;
		this.endsAt = endsAt;
	}

	/** A cancellation by the business never costs the customer anything; the schema insists. */
	void cancelByBusiness(Instant when) {
		this.status = RequestStatus.CANCELLED;
		this.cancelledAt = when;
		this.cancelledBy = BookingParty.BUSINESS;
		this.cancellationFeeCharged = BigDecimal.ZERO;
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

	/**
	 * Out of the business's inbox until the customer writes again. The request itself is untouched:
	 * it is the customer's record, and their link still opens it.
	 */
	void hideFromInbox(Instant when) {
		this.inboxHiddenAt = when;
	}

	/** Whether the inbox leaves it out: hidden, and nothing written since. */
	boolean hiddenFromInbox(Instant lastActivity) {
		return inboxHiddenAt != null && !lastActivity.isAfter(inboxHiddenAt);
	}

	void decline(Instant when, String reason) {
		this.status = RequestStatus.DECLINED;
		this.decidedAt = when;
		this.declineReason = reason;
	}
}
