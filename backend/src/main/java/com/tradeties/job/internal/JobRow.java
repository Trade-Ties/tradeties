package com.tradeties.job.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.tradeties.business.GeoPoint;
import com.tradeties.job.AppointmentDetails;
import com.tradeties.job.BookingParty;
import com.tradeties.job.ContactMethod;
import com.tradeties.job.NewJob;

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
 * What a customer wants done: the address, the description, and how to reach them.
 *
 * <p>Named {@code JobRow} rather than {@code Job} for the reason {@code ServiceOffering} is not
 * called {@code Service} — the wire type generated from the contract would otherwise collide.
 *
 * <p><strong>No status column.</strong> Whether anything is outstanding is a count over the
 * requests; a column beside that count is a second place for one truth, and the one that drifts.
 *
 * <p>{@code customerUserId} stays null for now and is the seam for customer accounts, which
 * {@code RegistrationIntent} already has the shape to take.
 */
@Entity
@Table(name = "job")
class JobRow {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "customer_user_id")
	private UUID customerUserId;

	@Enumerated(EnumType.STRING)
	@Column(name = "created_by", nullable = false, updatable = false, length = 16)
	private BookingParty createdBy;

	@Column(name = "customer_name", nullable = false, length = 200)
	private String customerName;

	/** Always present on a job a customer sent; a business entering one may leave it out. */
	@Column(name = "customer_email", length = 320)
	private String customerEmail;

	@Column(name = "customer_phone", length = 16)
	private String customerPhone;

	@Enumerated(EnumType.STRING)
	@Column(name = "preferred_contact", length = 16)
	private ContactMethod preferredContact;

	@Column(name = "description", length = 2000)
	private String description;

	@Column(name = "trade_id", nullable = false, updatable = false)
	private UUID tradeId;

	@Column(name = "street1", length = 200)
	private String street1;

	@Column(name = "street2", length = 200)
	private String street2;

	@Column(name = "city", length = 100)
	private String city;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "state", length = 2)
	private String state;

	@Column(name = "postal_code", length = 10)
	private String postalCode;

	@Column(name = "latitude")
	private BigDecimal latitude;

	@Column(name = "longitude")
	private BigDecimal longitude;

	@Column(name = "time_zone", nullable = false, length = 64)
	private String timeZone;

	/**
	 * The SHA-256 of the token, never the token. This row is otherwise a password store in the
	 * clear — the value is a credential that grants access to somebody's address and phone number.
	 */
	@Column(name = "access_token_hash", length = 64)
	private String accessTokenHash;

	/** Null together with the hash on a job the business entered: nobody has a link to it. */
	@Column(name = "access_token_expires_at")
	private Instant accessTokenExpiresAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected JobRow() {
		// for JPA
	}

	JobRow(NewJob details, UUID tradeId, String timeZone, GeoPoint located,
			String accessTokenHash, Instant accessTokenExpiresAt) {

		this.createdBy = BookingParty.CUSTOMER;
		this.customerName = details.customerName();
		this.customerEmail = details.customerEmail();
		this.customerPhone = details.customerPhone();
		this.preferredContact = details.preferredContact();
		this.description = details.description();
		this.tradeId = tradeId;
		this.street1 = details.address().street1();
		this.street2 = details.address().street2();
		this.city = details.address().city();
		this.state = details.address().state();
		this.postalCode = details.address().postalCode();
		this.timeZone = timeZone;
		this.accessTokenHash = accessTokenHash;
		this.accessTokenExpiresAt = accessTokenExpiresAt;

		// Both or neither, which is what the table's own check constraint says. A site that could
		// not be placed is stored without coordinates rather than with half of them.
		if (located != null) {
			this.latitude = located.latitude();
			this.longitude = located.longitude();
		}
	}

	/** A job the business entered itself, for a customer who phoned or a regular. */
	JobRow(AppointmentDetails details, UUID tradeId, String timeZone, GeoPoint located) {
		this.createdBy = BookingParty.BUSINESS;
		this.tradeId = tradeId;
		this.timeZone = timeZone;
		correct(details, located);
	}

	/**
	 * Only on a job the business entered. One a customer sent holds their own words, and is the
	 * same row every business they asked reads.
	 */
	void correct(AppointmentDetails details, GeoPoint located) {
		if (createdBy != BookingParty.BUSINESS) {
			throw new IllegalStateException("Job " + id + " was sent by its customer and is not the business's to edit");
		}

		this.customerName = details.customerName().trim();
		this.customerPhone = blankToNull(details.customerPhone());
		this.customerEmail = blankToNull(details.customerEmail());
		this.description = blankToNull(details.notes());
		this.street1 = blankToNull(details.street1());
		this.city = blankToNull(details.city());
		this.state = blankToNull(details.state());
		this.postalCode = blankToNull(details.postalCode());
		this.latitude = located == null ? null : located.latitude();
		this.longitude = located == null ? null : located.longitude();
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
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

	BookingParty createdBy() {
		return createdBy;
	}

	Instant accessTokenExpiresAt() {
		return accessTokenExpiresAt;
	}

	String timeZone() {
		return timeZone;
	}

	String customerName() {
		return customerName;
	}

	String customerEmail() {
		return customerEmail;
	}

	String customerPhone() {
		return customerPhone;
	}

	ContactMethod preferredContact() {
		return preferredContact;
	}

	String description() {
		return description;
	}

	String street1() {
		return street1;
	}

	String street2() {
		return street2;
	}

	String city() {
		return city;
	}

	String state() {
		return state;
	}

	String postalCode() {
		return postalCode;
	}
}
