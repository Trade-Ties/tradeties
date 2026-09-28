package com.tradeties.job.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.tradeties.business.GeoPoint;
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

	@Column(name = "customer_name", nullable = false, length = 200)
	private String customerName;

	@Column(name = "customer_email", nullable = false, length = 320)
	private String customerEmail;

	@Column(name = "customer_phone", length = 16)
	private String customerPhone;

	@Enumerated(EnumType.STRING)
	@Column(name = "preferred_contact", length = 16)
	private ContactMethod preferredContact;

	@Column(name = "description", nullable = false, length = 2000)
	private String description;

	@Column(name = "trade_id", nullable = false, updatable = false)
	private UUID tradeId;

	@Column(name = "street1", nullable = false, length = 200)
	private String street1;

	@Column(name = "street2", length = 200)
	private String street2;

	@Column(name = "city", nullable = false, length = 100)
	private String city;

	/** {@code CHAR(2)} and a foreign key to {@code us_state}, exactly as the profile stores it. */
	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "state", nullable = false, length = 2)
	private String state;

	@Column(name = "postal_code", nullable = false, length = 10)
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
	@Column(name = "access_token_hash", nullable = false, length = 64)
	private String accessTokenHash;

	@Column(name = "access_token_expires_at", nullable = false)
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
