package com.tradeties.identity.internal;

import java.time.Instant;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.tradeties.identity.MarketplaceUser;
import com.tradeties.identity.Role;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * The local projection of a WorkOS user.
 *
 * <p>Package-private on purpose: nothing outside {@code identity.internal} gets to hold a
 * managed entity. Callers receive a {@link MarketplaceUser} value instead.
 *
 * <p>A row exists only for someone who has registered. Authenticating alone writes nothing.
 */
@Entity
@Table(name = "identity_user")
class UserAccount {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "workos_user_id", nullable = false, updatable = false, length = 255)
	private String workosUserId;

	@Column(name = "email", length = 320)
	private String email;

	/**
	 * EAGER is normally a smell, but roles are a handful of enum values that every caller of
	 * this entity wants, and {@code open-in-view: false} means a lazy set would simply fail
	 * outside the transaction. Fetching them with the user is the honest description.
	 */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "identity_user_role", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "role", nullable = false, length = 64)
	@Enumerated(EnumType.STRING)
	private Set<Role> roles = new HashSet<>();

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/**
	 * Optimistic locking. Registration is not the interesting case — accept-vs-withdraw in
	 * the {@code job} module is — but a version column costs nothing now and cannot be added
	 * later without a data migration.
	 */
	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected UserAccount() {
		// for JPA
	}

	UserAccount(String workosUserId, String email) {
		this.workosUserId = Objects.requireNonNull(workosUserId, "workosUserId");
		this.email = email;
	}

	@PrePersist
	void stampCreation() {
		Instant now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	/**
	 * Adds roles without ever removing one. Registering as a tradesperson must not strip a
	 * {@code CUSTOMER} role the same person already holds — roles are additive.
	 *
	 * <p>Touches {@code updatedAt} explicitly rather than through {@code @PreUpdate}: a change
	 * to a collection alone does not necessarily mark the owning entity dirty, so the callback
	 * would silently not fire for exactly the change this method makes.
	 */
	void grant(Set<Role> granted) {
		if (roles.containsAll(granted)) {
			return;
		}

		roles.addAll(granted);
		this.updatedAt = Instant.now();
	}

	void updateEmail(String email) {
		if (Objects.equals(this.email, email)) {
			return;
		}

		this.email = email;
		this.updatedAt = Instant.now();
	}

	MarketplaceUser toMarketplaceUser() {
		return new MarketplaceUser(id, workosUserId, email, roles);
	}
}
