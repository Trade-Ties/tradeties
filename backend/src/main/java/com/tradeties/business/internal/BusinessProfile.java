package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.tradeties.business.BusinessDetails;
import com.tradeties.business.BusinessInput;
import com.tradeties.business.BusinessStatus;
import com.tradeties.business.GeoPoint;
import com.tradeties.business.OnboardingStep;
import com.tradeties.business.PostalAddress;
import com.tradeties.business.ProfileSuspendedException;

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
 * Package-private on purpose: nothing outside {@code business.internal} holds a managed entity.
 *
 * <p>The row is created the moment onboarding step 2 is saved and never before — address, time
 * zone and service radius are all mandatory, so there is nothing valid to persist while the wizard
 * is still on step 1.
 */
@Entity
@Table(name = "business_profile")
class BusinessProfile {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	/**
	 * References {@code identity_user.id}, never the WorkOS id — that indirection is what
	 * keeps the identity provider replaceable (DECISIONS section 7).
	 */
	@Column(name = "owner_user_id", nullable = false, updatable = false)
	private UUID ownerUserId;

	@Column(name = "slug", nullable = false, length = 80)
	private String slug;

	@Column(name = "legal_name", nullable = false, length = 200)
	private String legalName;

	@Column(name = "display_name", nullable = false, length = 200)
	private String displayName;

	@Column(name = "description", length = 2000)
	private String description;

	@Column(name = "website_url", length = 2048)
	private String websiteUrl;

	@Column(name = "phone", nullable = false, length = 16)
	private String phone;

	@Column(name = "email", nullable = false, length = 320)
	private String email;

	@Column(name = "street1", nullable = false, length = 200)
	private String street1;

	@Column(name = "street2", length = 200)
	private String street2;

	@Column(name = "city", nullable = false, length = 100)
	private String city;

	/** {@code CHAR(2)}, not {@code VARCHAR}: fixed-width by nature, and a foreign key to {@code us_state}. */
	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "state", nullable = false, length = 2)
	private String state;

	@Column(name = "postal_code", nullable = false, length = 10)
	private String postalCode;

	@Column(name = "latitude", precision = 9, scale = 6)
	private BigDecimal latitude;

	@Column(name = "longitude", precision = 9, scale = 6)
	private BigDecimal longitude;

	@Column(name = "time_zone", nullable = false, length = 64)
	private String timeZone;

	@Column(name = "service_radius_miles", nullable = false)
	private int serviceRadiusMiles;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 32)
	private BusinessStatus status;

	/**
	 * Server-owned, never read from a request body — which is what makes it unfakeable.
	 *
	 * <p>Only two values are written through this field: {@link OnboardingStep#ADDRESS} when the row
	 * is created, and {@link OnboardingStep#PUBLISHED} when it goes live. Everything in between is
	 * recorded by {@code BusinessProfileRepository#advanceOnboardingStep}, which deliberately does
	 * not go through the entity — see the reasoning there.
	 */
	@Column(name = "onboarding_completed_step", nullable = false)
	private short onboardingCompletedStep;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected BusinessProfile() {
		// for JPA
	}

	BusinessProfile(UUID ownerUserId, BusinessInput input) {
		this.ownerUserId = Objects.requireNonNull(ownerUserId, "ownerUserId");
		this.status = BusinessStatus.DRAFT;
		this.onboardingCompletedStep = OnboardingStep.ADDRESS.number();
		apply(input);
	}

	/**
	 * Unlike {@code UserAccount}, this entity can rely on {@code @PreUpdate}: everything it changes
	 * is a scalar field, so a modification always marks the entity dirty.
	 */
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
	 * Overwrites every field the tradesperson supplies, including with {@code null}, because the
	 * contract makes the update a replacement: an omitted description means "no description", not
	 * "leave it alone". A null check here would quietly turn the replacement back into a merge and
	 * make clearing a field impossible.
	 *
	 * <p>{@code status} and {@code onboardingCompletedStep} are absent on purpose — neither is the
	 * client's to move, and their absence is also what stops this call moving the marker
	 * <em>backwards</em>.
	 */
	final void apply(BusinessInput input) {
		this.slug = input.slug();
		this.legalName = input.legalName();
		this.displayName = input.displayName();
		this.description = input.description();
		this.websiteUrl = input.websiteUrl();
		this.phone = input.phone();
		this.email = input.email();

		PostalAddress address = input.address();
		this.street1 = address.street1();
		this.street2 = address.street2();
		this.city = address.city();
		this.state = address.state();
		this.postalCode = address.postalCode();

		GeoPoint coordinates = input.coordinates();
		this.latitude = coordinates == null ? null : coordinates.latitude();
		this.longitude = coordinates == null ? null : coordinates.longitude();

		this.timeZone = input.timeZone();
		this.serviceRadiusMiles = input.serviceRadiusMiles();
	}

	UUID id() {
		return id;
	}

	BusinessStatus status() {
		return status;
	}

	/**
	 * Read before {@link #apply} overwrites it, to see whether a write is changing the zone.
	 * Nothing else needs it — {@link #toDetails} carries the value out for everybody else.
	 */
	String timeZone() {
		return timeZone;
	}

	/**
	 * Publishing completes the wizard, so the step marker goes with it. Publishing an already
	 * published profile changes nothing and is not an error — the caller wanted it visible,
	 * and it is.
	 *
	 * @throws ProfileSuspendedException if the profile is suspended
	 */
	void publish() {
		requireNotSuspended();
		this.status = BusinessStatus.PUBLISHED;
		this.onboardingCompletedStep = OnboardingStep.PUBLISHED.number();
	}

	/**
	 * Back to a draft. The step marker stays where it is: the wizard was completed, and going
	 * offline does not undo that.
	 *
	 * @throws ProfileSuspendedException if the profile is suspended
	 */
	void unpublish() {
		requireNotSuspended();
		this.status = BusinessStatus.DRAFT;
	}

	/**
	 * Suspension is the marketplace's state, and the holder cannot step out of it in
	 * <em>either</em> direction — publishing ends with a profile the marketplace switched off being
	 * visible again.
	 *
	 * <p>Guarded on the transition rather than only in the service, so a third way out — an admin
	 * endpoint, an event listener — inherits the rule instead of having to remember it.
	 */
	private void requireNotSuspended() {
		if (status == BusinessStatus.SUSPENDED) {
			throw new ProfileSuspendedException();
		}
	}

	long version() {
		return version;
	}

	BusinessDetails toDetails() {
		return new BusinessDetails(
				slug,
				legalName,
				displayName,
				description,
				websiteUrl,
				phone,
				email,
				new PostalAddress(street1, street2, city, state, postalCode),
				latitude == null ? null : new GeoPoint(latitude, longitude),
				timeZone,
				serviceRadiusMiles,
				status,
				onboardingCompletedStep,
				version);
	}
}
