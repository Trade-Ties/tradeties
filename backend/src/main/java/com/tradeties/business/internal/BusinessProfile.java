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
import com.tradeties.business.SlugLockedException;

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

	/**
	 * Set exactly when the coordinates are, which a constraint in V11 enforces — so the three move
	 * as one and are only ever written together, by {@link #apply}.
	 */
	@Enumerated(EnumType.STRING)
	@Column(name = "geocode_precision", length = 16)
	private GeocodePrecision geocodePrecision;

	/**
	 * When the address-level geocoder last looked at this profile, whether or not it found
	 * anything. Written by the background pass in {@code GeocodeRefiner}, and cleared by
	 * {@link #apply} when the address moves — see there for why both halves are needed.
	 */
	@Column(name = "geocode_attempted_at")
	private Instant geocodeAttemptedAt;

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

	/**
	 * When this profile first went live, and null while it never has.
	 *
	 * <p>The reason it exists is the slug. That column is not really the holder's data — it is
	 * {@code tradeties.com/pro/{slug}}, printed on a van and read out over the phone — and once a
	 * copy of it is out in the world nothing here can correct it. So the URL stays editable exactly
	 * as long as no copy can exist, which is exactly as long as the profile has never been
	 * published.
	 *
	 * <p>{@code status} cannot stand in for this: {@link #unpublish()} puts a business that was live
	 * for a year back to {@code DRAFT}, where it looks identical to one that never published.
	 */
	@Column(name = "first_published_at")
	private Instant firstPublishedAt;

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

	BusinessProfile(UUID ownerUserId, BusinessInput input, Geocode geocode) {
		this.ownerUserId = Objects.requireNonNull(ownerUserId, "ownerUserId");
		this.status = BusinessStatus.DRAFT;
		this.onboardingCompletedStep = OnboardingStep.ADDRESS.number();
		apply(input, geocode);
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
	 *
	 * @param geocode where the address in {@code input} sits, or {@code null} when it could not be
	 *        located. Passed in rather than read off {@code input.coordinates()}: deciding between
	 *        what the client sent and what the geocoder found needs the <em>stored</em> address to
	 *        compare against, which the entity has and this method has already overwritten by the
	 *        time it would matter. {@code BusinessService} settles it before calling.
	 * @throws SlugLockedException if the URL has been published and this would change it
	 */
	final void apply(BusinessInput input, Geocode geocode) {
		requireSlugStillOpen(input.slug());
		// Asked before the fields below overwrite the answer.
		boolean relocating = addressWouldMove(input.address());
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

		GeoPoint coordinates = geocode == null ? null : geocode.point();
		this.latitude = coordinates == null ? null : coordinates.latitude();
		this.longitude = coordinates == null ? null : coordinates.longitude();
		this.geocodePrecision = geocode == null ? null : geocode.precision();

		// Both halves of the refiner's queue, and it takes both. Resetting the precision alone
		// is not enough: a profile already sharpened once carries a recent attempt stamp, and the
		// query wants ZIP *and* not-asked-recently. Left as it was, a business that moved would
		// sit on the centroid of its new ZIP until the retry window expired -- correct, coarse,
		// and a month late. Cleared only when the address actually moves, so the window still
		// does its job for an address the service can never match.
		if (relocating) {
			this.geocodeAttemptedAt = null;
		}

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

	boolean slugLocked() {
		return firstPublishedAt != null;
	}

	/**
	 * Whether the address resolved to a point, which is what the publishing checklist asks.
	 *
	 * <p>Latitude alone answers for both columns: a CHECK in V3 keeps them null or set together,
	 * so there is no half-located row for the second half of the test to catch.
	 */
	/**
	 * The stored address as one value, for the background geocoder — which needs the fields and
	 * nothing else on the profile. {@link #toDetails} assembles the same thing on its way past;
	 * this exists so a caller that wants only the address does not have to build the rest.
	 */
	PostalAddress address() {
		return new PostalAddress(street1, street2, city, state, postalCode);
	}

	boolean hasCoordinates() {
		return latitude != null;
	}

	/**
	 * The URL is the holder's to choose until somebody else holds a copy of it.
	 *
	 * <p>Sending the stored value back is not a change and is always allowed. It has to be: the
	 * update is a full replacement, so the slug arrives on every write whether or not anyone
	 * touched it.
	 *
	 * <p>Guarded on the transition rather than only in the service, like
	 * {@link #requireNotSuspended()}: {@link #apply} is the only way this column moves, so a third
	 * way in — an admin fix-up, a restore tool, an import — inherits the rule. {@code BusinessService}
	 * also calls this directly, because it needs the answer <em>before</em> it puts the time zone
	 * question, so a write changing both is not sent back to confirm a calendar move only to be
	 * refused for the URL anyway.
	 *
	 * <p>Not a database constraint, although the rest of this table's rules are. A CHECK compares
	 * columns within one row; this compares the new slug against the old one, which is a statement
	 * about a transition. The row-local half of the rule — a published profile has a
	 * {@code first_published_at} — <em>is</em> a constraint, and is one.
	 *
	 * @throws SlugLockedException if the URL is fixed and {@code proposed} is not it
	 */
	void requireSlugStillOpen(String proposed) {
		if (slugLocked() && slugWouldMove(proposed)) {
			throw new SlugLockedException(slug);
		}
	}

	/**
	 * Here rather than through a getter the service compares for itself, because it is the same
	 * question {@link #requireSlugStillOpen} asks and the two must not part company. An update is a
	 * full replacement, so the stored slug comes back unchanged on nearly every save of steps 1 and
	 * 2 — which is what makes it worth asking before probing the slug index.
	 */
	boolean slugWouldMove(String proposed) {
		return !slug.equals(proposed);
	}

	/**
	 * Whether this write is putting the business somewhere else, which is what decides if the
	 * address-level geocoder has to look again.
	 *
	 * <p>The whole address, not the postal code the ZIP lookup reads. The question is whether the
	 * thing being located changed — the Census geocoder moves on a house number, and this is the
	 * call that would otherwise go on feeding it a stale answer.
	 */
	private boolean addressWouldMove(PostalAddress proposed) {
		return !new PostalAddress(street1, street2, city, state, postalCode).equals(proposed);
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
		// The first one only, and republishing must not move it: the slug became an address the day
		// it first went out, not the last time somebody switched the profile back on.
		if (this.firstPublishedAt == null) {
			this.firstPublishedAt = Instant.now();
		}
	}

	/**
	 * Back to a draft. The step marker stays where it is: the wizard was completed, and going
	 * offline does not undo that. Neither does {@link #firstPublishedAt}: the links handed out
	 * while the profile was live are still out there, so the slug stays locked.
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
				slugLocked(),
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
