package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.tradeties.availability.BookingRules;
import com.tradeties.availability.HoursBlock;
import com.tradeties.availability.OpenDay;
import com.tradeties.availability.WorkingWeek;
import com.tradeties.business.OnboardingProgress;
import com.tradeties.business.OnboardingStep;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The write paths of the calendar, each of them behind the lock.
 *
 * <p>Separate from {@code CalendarService} only so the provisioning transaction can commit before
 * these begin — see {@link PolicyProvisioning}. Every method here assumes the policy row exists
 * and takes it {@code FOR UPDATE} as its first act.
 *
 * <p>The wizard's marker is reported through {@link OnboardingProgress} inside the same
 * transaction as the write it describes. A step recorded for a week that then rolled back would
 * be a marker pointing at nothing.
 *
 * <p><strong>Lock order: policy before profile, never the reverse.</strong> These methods lock
 * {@code availability_booking_policy} first and touch {@code business_profile} last, while
 * everything in {@code business} takes the profile row on its own. The third and fourth calendar
 * write paths have to keep that order, or the two deadlock.
 */
@Component
class CalendarWrites {

	private final BookingPolicyRepository policies;
	private final WorkingHoursRepository hours;
	private final OnboardingProgress onboarding;

	CalendarWrites(BookingPolicyRepository policies,
			WorkingHoursRepository hours,
			OnboardingProgress onboarding) {

		this.policies = policies;
		this.hours = hours;
		this.onboarding = onboarding;
	}

	/**
	 * Deleting and re-inserting is safe here, unlike with trades, because nothing points at a
	 * working-hours row.
	 *
	 * <p>The flush between the two halves is not cosmetic: without it Hibernate is free to order the
	 * inserts before the deletes, and the exclusion constraint would then see the old and new blocks
	 * at the same time and reject a week that is perfectly valid.
	 */
	@Transactional
	void replaceWeek(UUID businessId, WorkingWeek week) {
		// Taken for the lock, not for the row: every calendar write serialises on this one.
		lock(businessId);

		hours.deleteByBusinessId(businessId);
		hours.flush();

		List<WorkingHoursRow> rows = new ArrayList<>();
		for (Map.Entry<DayOfWeek, OpenDay> entry : week.byDay().entrySet()) {
			for (HoursBlock block : entry.getValue().blocks()) {
				rows.add(new WorkingHoursRow(businessId, entry.getKey(), block));
			}
		}

		hours.saveAllAndFlush(rows);

		onboarding.record(businessId, OnboardingStep.WORKING_HOURS);
	}

	@Transactional
	BookingRules replaceRules(UUID businessId, long expectedVersion, BookingRules rules) {
		BookingPolicyRow policy = lock(businessId);

		if (policy.version() != expectedVersion) {
			throw new OptimisticLockingFailureException("The booking rules changed since they were read");
		}

		policy.apply(rules);

		BookingRules stored = policies.saveAndFlush(policy).toRules();
		onboarding.record(businessId, OnboardingStep.BOOKING_RULES);

		return stored;
	}

	/**
	 * @throws IllegalStateException if the row is missing — a bug, not a user error.
	 *         {@link PolicyProvisioning} runs before every one of these and commits.
	 */
	private BookingPolicyRow lock(UUID businessId) {
		return policies.lockByBusinessId(businessId)
				.orElseThrow(() -> new IllegalStateException(
						"No booking policy for business " + businessId + " — provisioning did not run"));
	}
}
