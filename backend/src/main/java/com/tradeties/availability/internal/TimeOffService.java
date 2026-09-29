package com.tradeties.availability.internal;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.availability.TimeOffAnswers;
import com.tradeties.availability.TimeOffDraft;
import com.tradeties.availability.TimeOffEntry;
import com.tradeties.business.Businesses;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Time off and blocked hours, read and written on the business's own clock.
 *
 * <p>The write methods carry no {@code @Transactional}, for the reason {@link CalendarService}'s
 * do not: provisioning has to commit before the write behind the lock begins.
 */
@Service
public class TimeOffService {

	private final Businesses businesses;
	private final PolicyProvisioning provisioning;
	private final TimeOffWrites writes;
	private final TimeOffRepository absences;

	TimeOffService(Businesses businesses,
			PolicyProvisioning provisioning,
			TimeOffWrites writes,
			TimeOffRepository absences) {

		this.businesses = businesses;
		this.provisioning = provisioning;
		this.writes = writes;
		this.absences = absences;
	}

	/** @return empty only when the caller has no business at all */
	@Transactional(readOnly = true)
	public Optional<List<TimeOffEntry>> findUpcomingByOwner(UUID ownerUserId) {
		return ownedBy(ownerUserId).map(owned -> absences
				.findByBusinessIdAndEndsAtAfterOrderByStartsAtAsc(owned.id(), Instant.now()).stream()
				.map(row -> TimeOffSpan.describe(row, owned.zone()))
				.toList());
	}

	/** @return empty only when the caller has no business at all */
	public Optional<TimeOffEntry> addForOwner(UUID ownerUserId, TimeOffDraft draft, TimeOffAnswers answers) {
		return ownedBy(ownerUserId).map(owned -> {
			TimeOffSpan span = TimeOffSpan.of(draft, owned.zone());
			provisioning.ensureExists(owned.id());

			return TimeOffSpan.describe(
					writes.add(owned.id(), ownerUserId, span, draft.allDay(), noteOf(draft), answers),
					owned.zone());
		});
	}

	/** @return empty when the caller has no business, or no entry with that id */
	public Optional<TimeOffEntry> replaceForOwner(UUID ownerUserId, UUID timeOffId, long expectedVersion,
			TimeOffDraft draft, TimeOffAnswers answers) {

		return ownedBy(ownerUserId).flatMap(owned -> {
			TimeOffSpan span = TimeOffSpan.of(draft, owned.zone());
			provisioning.ensureExists(owned.id());

			return writes.replace(owned.id(), timeOffId, expectedVersion, span, draft.allDay(), noteOf(draft), answers)
					.map(row -> TimeOffSpan.describe(row, owned.zone()));
		});
	}

	/** @return false when the caller has no business, or no entry with that id */
	public boolean removeForOwner(UUID ownerUserId, UUID timeOffId) {
		return businesses.findIdByOwner(ownerUserId)
				.map(businessId -> {
					provisioning.ensureExists(businessId);
					return writes.remove(businessId, timeOffId);
				})
				.orElse(false);
	}

	private Optional<Owned> ownedBy(UUID ownerUserId) {
		return businesses.findIdByOwner(ownerUserId).flatMap(id -> businesses.findTimeZoneByOwner(ownerUserId)
				.map(zone -> new Owned(id, zone)));
	}

	private static String noteOf(TimeOffDraft draft) {
		return draft.note() == null || draft.note().isBlank() ? null : draft.note().trim();
	}

	private record Owned(UUID id, ZoneId zone) {
	}
}
