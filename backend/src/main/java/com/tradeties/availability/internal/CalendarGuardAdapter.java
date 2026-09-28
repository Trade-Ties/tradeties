package com.tradeties.availability.internal;

import java.time.Instant;
import java.util.UUID;

import com.tradeties.availability.BookingRules;
import com.tradeties.availability.CalendarGuard;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hands {@code job} the calendar's mutex without handing it the table.
 *
 * <p>The row is provisioned before it is locked, because {@code SELECT … FOR UPDATE} over zero
 * rows locks nothing and reports no error — V4 says so at the table, and a business whose first
 * calendar write is an acceptance would otherwise serialise against nobody.
 */
@Service
class CalendarGuardAdapter implements CalendarGuard {

	private final BookingPolicyRepository policies;
	private final PolicyProvisioning provisioning;
	private final TimeOffRepository absences;

	CalendarGuardAdapter(BookingPolicyRepository policies,
			PolicyProvisioning provisioning,
			TimeOffRepository absences) {

		this.policies = policies;
		this.provisioning = provisioning;
		this.absences = absences;
	}

	/**
	 * {@code MANDATORY} rather than {@code REQUIRED}: a lock taken in a transaction of its own
	 * would be released the moment this method returned, and the caller would go on believing it
	 * held one. Refusing to run outside a transaction turns that into a startup-time mistake
	 * rather than a race nobody can reproduce.
	 */
	@Override
	@Transactional(propagation = Propagation.MANDATORY)
	public BookingRules lockForWriting(UUID businessId) {
		provisioning.ensureExists(businessId);

		return policies.lockByBusinessId(businessId)
				.map(BookingPolicyRow::toRules)
				.orElseThrow(() -> new IllegalStateException(
						"No booking policy for business " + businessId + " after provisioning it"));
	}

	@Override
	@Transactional(readOnly = true)
	public boolean isAway(UUID businessId, Instant startsAt, Instant endsAt) {
		return absences.findByBusinessIdAndEndsAtAfter(businessId, startsAt).stream()
				.anyMatch(off -> off.startsAt().isBefore(endsAt) && startsAt.isBefore(off.endsAt()));
	}
}
