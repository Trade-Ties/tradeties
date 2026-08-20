package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.availability.BookingRules;
import com.tradeties.availability.HoursBlock;
import com.tradeties.availability.InvalidWorkingWeekException;
import com.tradeties.availability.OpenDay;
import com.tradeties.availability.WorkingWeek;
import com.tradeties.business.Businesses;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding steps 7 and 8.
 *
 * <p>The write methods deliberately carry no {@code @Transactional} of their own: provisioning
 * has to commit before the write behind the lock begins — see {@link PolicyProvisioning}.
 */
@Service
public class CalendarService {

	private final Businesses businesses;
	private final PolicyProvisioning provisioning;
	private final CalendarWrites writes;
	private final BookingPolicyRepository policies;
	private final WorkingHoursRepository hours;

	CalendarService(Businesses businesses,
			PolicyProvisioning provisioning,
			CalendarWrites writes,
			BookingPolicyRepository policies,
			WorkingHoursRepository hours) {

		this.businesses = businesses;
		this.provisioning = provisioning;
		this.writes = writes;
		this.policies = policies;
		this.hours = hours;
	}

	/**
	 * @return the stored week, or an all-closed one for a business that has not reached step 7.
	 *         Empty only when the caller has no business at all.
	 */
	@Transactional(readOnly = true)
	public Optional<WorkingWeek> findWeekByOwner(UUID ownerUserId) {
		return businesses.findIdByOwner(ownerUserId).map(this::readWeek);
	}

	/**
	 * @return the stored rules, or the defaults for a business that has not reached step 8.
	 *         Never a 404 for an existing business — the defaults are a real answer, and they
	 *         are exactly what would be provisioned on the first write.
	 */
	@Transactional(readOnly = true)
	public Optional<BookingRules> findRulesByOwner(UUID ownerUserId) {
		return businesses.findIdByOwner(ownerUserId)
				.map(businessId -> policies.findById(businessId)
						.map(BookingPolicyRow::toRules)
						.orElseGet(BookingRules::defaults));
	}

	public Optional<WorkingWeek> replaceWeekForOwner(UUID ownerUserId, WorkingWeek week) {
		Optional<UUID> businessId = businesses.findIdByOwner(ownerUserId);
		if (businessId.isEmpty()) {
			return Optional.empty();
		}

		requireCoherent(week);

		provisioning.ensureExists(businessId.get());
		writes.replaceWeek(businessId.get(), week);

		return Optional.of(readWeek(businessId.get()));
	}

	public Optional<BookingRules> replaceRulesForOwner(UUID ownerUserId, long expectedVersion, BookingRules rules) {
		Optional<UUID> businessId = businesses.findIdByOwner(ownerUserId);
		if (businessId.isEmpty()) {
			return Optional.empty();
		}

		provisioning.ensureExists(businessId.get());

		return Optional.of(writes.replaceRules(businessId.get(), expectedVersion, rules));
	}

	private WorkingWeek readWeek(UUID businessId) {
		Map<DayOfWeek, List<HoursBlock>> blocks = new EnumMap<>(DayOfWeek.class);
		for (DayOfWeek day : DayOfWeek.values()) {
			blocks.put(day, new ArrayList<>());
		}

		hours.findByBusinessId(businessId)
				.forEach(row -> blocks.get(row.day()).add(row.toBlock()));

		List<OpenDay> days = new ArrayList<>();
		for (DayOfWeek day : DayOfWeek.values()) {
			List<HoursBlock> ordered = blocks.get(day).stream()
					.sorted(java.util.Comparator.comparingInt(HoursBlock::startsAtMinutes))
					.toList();

			days.add(new OpenDay(day, ordered));
		}

		return new WorkingWeek(days);
	}

	/**
	 * What the schema would reject, said in terms of days rather than constraint names.
	 *
	 * <p>Overlap uses half-open intervals — the same boundary as the exclusion constraint — so
	 * 08:00–12:00 and 12:00–18:00 are adjacent rather than overlapping.
	 */
	private static void requireCoherent(WorkingWeek week) {
		for (OpenDay day : week.byDay().values()) {
			List<HoursBlock> blocks = day.blocks();

			for (HoursBlock block : blocks) {
				if (block.endsAtMinutes() <= block.startsAtMinutes()) {
					throw new InvalidWorkingWeekException(day.day()
							+ ": a block must end after it starts, and must not run past midnight — "
							+ "a day may end at 24:00, and a night shift is two blocks on two days, "
							+ "22:00–24:00 and 00:00–02:00");
				}
			}

			for (int i = 0; i < blocks.size(); i++) {
				for (int j = i + 1; j < blocks.size(); j++) {
					if (blocks.get(i).overlaps(blocks.get(j))) {
						throw new InvalidWorkingWeekException(day.day() + ": two blocks overlap");
					}
				}
			}
		}
	}
}
