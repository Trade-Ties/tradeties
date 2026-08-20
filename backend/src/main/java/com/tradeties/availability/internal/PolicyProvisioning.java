package com.tradeties.availability.internal;

import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

/**
 * Makes sure a business has a booking policy row, because everything else in this module locks on
 * it.
 *
 * <p>Two callers can arrive at once, both find nothing, and both insert; the primary key rejects
 * the loser. In PostgreSQL a failed statement poisons the surrounding transaction, so the insert
 * has to commit or roll back on its own before the caller goes on to write — which is why it
 * lives in {@link PolicyInsert}.
 *
 * <p><strong>Deliberately not {@code @Transactional} itself.</strong> That is the fix, not an
 * omission: with the annotation here, the failed flush marks this transaction rollback-only and
 * the <em>commit</em> throws {@code UnexpectedRollbackException} however cleanly the violation
 * was caught.
 *
 * <p>Swallowing the violation is only correct because by then the winner has committed and the
 * row exists — which is why that clause is checked below rather than assumed.
 */
@Component
class PolicyProvisioning {

	private final BookingPolicyRepository policies;
	private final PolicyInsert insert;

	PolicyProvisioning(BookingPolicyRepository policies, PolicyInsert insert) {
		this.policies = policies;
		this.insert = insert;
	}

	void ensureExists(UUID businessId) {
		if (policies.existsById(businessId)) {
			return;
		}

		try {
			insert.insert(businessId);
		}
		catch (DataIntegrityViolationException maybeLostTheInsertRace) {
			// The argument above holds for one violation only, the primary key. The same type also
			// arrives from the foreign key when the profile is deleted mid-flight, and swallowing that
			// leaves the caller to die further along on "provisioning did not run". Asked as an outcome
			// rather than matched on the constraint name, so a rename cannot break it.
			if (!policies.existsById(businessId)) {
				throw maybeLostTheInsertRace;
			}
		}
	}
}
