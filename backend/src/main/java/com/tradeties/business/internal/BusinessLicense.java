package com.tradeties.business.internal;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import com.tradeties.business.LicenseDefinition;
import com.tradeties.business.LicenseDetails;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * A licence a business holds in one state. Its own table rather than two columns on the profile,
 * because licensing is per state and a tradesperson near a state line legally works in two.
 */
@Entity
@Table(name = "business_license")
class BusinessLicense {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "business_id", nullable = false, updatable = false)
	private UUID businessId;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "state", nullable = false, length = 2)
	private String state;

	@Column(name = "license_number", nullable = false, length = 64)
	private String licenseNumber;

	@Column(name = "license_type", length = 120)
	private String licenseType;

	@Column(name = "issued_on")
	private LocalDate issuedOn;

	@Column(name = "expires_on")
	private LocalDate expiresOn;

	/**
	 * TradeTies' confirmation, and a strong trust signal on the US market. Set by an operator, never
	 * by the holder — and cleared automatically by {@link #apply} as soon as what it confirmed
	 * changes.
	 */
	@Column(name = "verified_at")
	private Instant verifiedAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected BusinessLicense() {
		// for JPA
	}

	BusinessLicense(UUID businessId, LicenseDefinition definition) {
		this.businessId = businessId;
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

	/**
	 * {@code verifiedAt} confirms one exact combination of state, number and type. Leaving the
	 * mark in place after any of the three is edited would let an unchecked number wear the previous
	 * one's seal — the cheapest possible way to fake a trust signal.
	 *
	 * <p>Issue and expiry dates deliberately do not trigger it: renewing a licence extends the same
	 * licence, and it is still the number that was checked.
	 */
	final void apply(LicenseDefinition definition) {
		boolean identityChanged = !Objects.equals(this.state, definition.state())
				|| !Objects.equals(this.licenseNumber, definition.licenseNumber())
				|| !Objects.equals(this.licenseType, definition.licenseType());

		if (identityChanged) {
			this.verifiedAt = null;
		}

		this.state = definition.state();
		this.licenseNumber = definition.licenseNumber();
		this.licenseType = definition.licenseType();
		this.issuedOn = definition.issuedOn();
		this.expiresOn = definition.expiresOn();
	}

	LocalDate expiresOn() {
		return expiresOn;
	}

	long version() {
		return version;
	}

	LicenseDetails toDetails() {
		return new LicenseDetails(id, state, licenseNumber, licenseType, issuedOn, expiresOn, verifiedAt, version);
	}
}
