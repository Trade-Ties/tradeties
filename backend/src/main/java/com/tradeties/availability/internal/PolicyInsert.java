package com.tradeties.availability.internal;

import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The transactional half of provisioning, split from {@link PolicyProvisioning} so the insert
 * race can be caught <em>outside</em> the transaction that lost it. Catching a constraint
 * violation inside that transaction cannot work: it is already marked rollback-only, so returning
 * normally makes the commit throw {@code UnexpectedRollbackException} instead.
 *
 * <p><strong>{@code REQUIRES_NEW}, not {@code REQUIRED}.</strong> With {@code REQUIRED}, a caller
 * that wrapped {@link #insert} in a transaction of its own would have that one poisoned instead.
 * A row left behind because an outer transaction later rolled back costs nothing: every column is
 * a default and provisioning is idempotent.
 *
 * <p><strong>{@code persist}, not {@code save}.</strong> {@code BookingPolicyRow} carries an
 * assigned id and a primitive version, so Spring Data reads it as not-new and {@code save}
 * becomes a {@code merge} — a select, then an <em>update</em> if the row turned up in the
 * meantime, silently overwriting a policy the winner may already have configured. An insert that
 * means insert fails exactly one way, and that one way is handled.
 *
 * <p>{@code @Repository} is what translates Hibernate's own {@code ConstraintViolationException}
 * into the {@code DataIntegrityViolationException} the caller catches.
 */
@Repository
class PolicyInsert {

	@PersistenceContext
	private EntityManager entityManager;

	/**
	 * Public despite the package-private class: proxying advises public methods most reliably, and
	 * a {@code @Transactional} that silently does nothing is precisely the failure this class exists
	 * to remove.
	 *
	 * @throws org.springframework.dao.DataIntegrityViolationException if another transaction
	 *         provisioned the row first. By the time it is thrown the winner has committed and this
	 *         transaction has rolled back on its own, which is what makes it safe for
	 *         {@link PolicyProvisioning} to shrug it off.
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void insert(UUID businessId) {
		entityManager.persist(new BookingPolicyRow(businessId));
		entityManager.flush();
	}
}
