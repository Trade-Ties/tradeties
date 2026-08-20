package com.tradeties.business.internal;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The first write of a business's rates, as an insert that means insert.
 *
 * <p><strong>{@code persist}, not {@code save}.</strong> The same trap {@code PolicyInsert} in
 * {@code availability} describes: an assigned id plus a primitive {@code @Version} makes Spring
 * Data read the instance as not-new, so {@code save} becomes a {@code merge} — a select and then
 * an <em>update</em> if the row turned up meanwhile, which would let the loser of two first writes
 * silently overwrite rates the winner had committed and answer 200 to a client owed a 409.
 *
 * <p><strong>{@code MANDATORY}, not {@code REQUIRES_NEW}.</strong> This is where it parts company
 * with {@code PolicyInsert}. A losing write of rates is not a no-op but a conflict, and the
 * rollback the violation forces is exactly what should happen to the caller — nothing written, and
 * in particular the onboarding step not advanced. Joining the caller's transaction is the point,
 * and {@code MANDATORY} states that requirement instead of hoping for it.
 *
 * <p>{@code @Repository} is what turns Hibernate's own {@code ConstraintViolationException} into
 * the {@code DataIntegrityViolationException} the caller catches.
 */
@Repository
class PricingInsert {

	@PersistenceContext
	private EntityManager entityManager;

	/**
	 * Public despite the package-private class, for the reason {@code PolicyInsert} gives: proxying
	 * advises public methods most reliably.
	 *
	 * @throws org.springframework.dao.DataIntegrityViolationException if another transaction wrote
	 *         this business's rates first. The caller's transaction is marked rollback-only by it,
	 *         so the only thing it can do afterwards is fail — which is what it wants.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public BusinessPricing insert(BusinessPricing pricing) {
		entityManager.persist(pricing);
		entityManager.flush();

		return pricing;
	}
}
