package com.tradeties.business.internal;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.tradeties.business.BusinessAlreadyExistsException;
import com.tradeties.business.BusinessDetails;
import com.tradeties.business.BusinessInput;
import com.tradeties.business.Businesses;
import com.tradeties.business.CalendarReadiness;
import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.OnboardingProgress;
import com.tradeties.business.OnboardingStep;
import com.tradeties.business.ReadinessCheckCode;
import com.tradeties.business.SlugTakenException;
import com.tradeties.business.StaleVersionException;
import com.tradeties.business.UnconfirmedTimeZoneChangeException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every method takes the owner's user id, and there is no overload that does not — the
 * ownership rule is carried by the signatures rather than by a check someone has to remember to
 * write.
 */
@Service
public class BusinessService implements Businesses, OnboardingProgress {

	private final BusinessProfileRepository repository;
	private final CatalogStateRepository states;
	private final CatalogTimeZoneRepository timeZones;
	private final CalendarReadiness calendar;
	private final Geocoder geocoder;
	private final PublishService publishing;

	BusinessService(BusinessProfileRepository repository,
			CatalogStateRepository states,
			CatalogTimeZoneRepository timeZones,
			CalendarReadiness calendar,
			Geocoder geocoder,
			PublishService publishing) {

		this.repository = repository;
		this.states = states;
		this.timeZones = timeZones;
		this.calendar = calendar;
		this.geocoder = geocoder;
		this.publishing = publishing;
	}

	@Transactional(readOnly = true)
	public Optional<BusinessDetails> findByOwner(UUID ownerUserId) {
		return repository.findByOwnerUserId(ownerUserId).map(BusinessProfile::toDetails);
	}

	@Override
	@Transactional(readOnly = true)
	public Optional<UUID> findIdByOwner(UUID ownerUserId) {
		return repository.findByOwnerUserId(ownerUserId).map(BusinessProfile::id);
	}

	/**
	 * The {@link OnboardingProgress} port, for the two steps {@code availability} owns.
	 *
	 * <p>{@code REQUIRED}, so it joins the caller's transaction rather than opening one beside it:
	 * the step is only true if the write it reports committed.
	 */
	@Override
	@Transactional
	public void record(UUID businessId, OnboardingStep step) {
		repository.advanceOnboardingStep(businessId, step.number());
	}

	/**
	 * The contract's pattern only says "two upper-case letters", so {@code XX} passes it and then
	 * fails the foreign key on {@code us_state} — a 500 about a constraint name. This check exists
	 * for the message, not for the guarantee.
	 */
	private void requireKnownState(String state) {
		if (!states.existsById(state)) {
			throw new InvalidSelectionException("No such US state: " + state);
		}
	}

	/**
	 * The contract can only cap the length — no pattern separates {@code America/Denver} from
	 * {@code Europe/Zurich123} — so without this check the foreign key on {@code time_zone} fires
	 * and surfaces as a 500. Like {@link #requireKnownState}, it exists for the message.
	 *
	 * <p>Checked against the table rather than {@link java.time.ZoneId}, so there is one source of
	 * truth. {@code ZoneId.of} would also accept {@code +02:00}, a fixed offset that knows nothing
	 * about daylight saving — precisely what the local-wall-clock model in V4 exists to avoid.
	 */
	private void requireKnownTimeZone(String timeZone) {
		if (!timeZones.existsById(timeZone)) {
			throw new InvalidSelectionException("No such time zone: " + timeZone);
		}
	}

	/**
	 * Where the address in this write sits, resolved on every create and every replace.
	 *
	 * <p>Unconditionally, rather than only when the address changed. It is one indexed lookup, and
	 * the alternative is a comparison that has to stay correct — a business that moves and keeps
	 * its old point disappears from the searches it belongs in and appears in ones it does not,
	 * with nothing about the profile looking wrong.
	 *
	 * <p><strong>{@code input.coordinates()} is deliberately not read.</strong> The contract offers
	 * it as an override for a dragged map pin, but there is no pin to drag, and the wizard sends
	 * the field on every save — it echoes back whatever the server last stored, so that saving
	 * steps 1 and 2 does not wipe the coordinates. Honouring it would therefore mean honouring an
	 * echo: the first geocode would freeze, and moving the business would never move the point.
	 * A request cannot distinguish the two, so nothing here tries. The override becomes
	 * implementable when a pin exists and the client can say it was moved.
	 *
	 * @return {@code null} when the address cannot be located, which stores no coordinates and is
	 *         what the profile does today
	 */
	private Geocode locate(BusinessInput input) {
		return geocoder.locate(input.address()).orElse(null);
	}

	/**
	 * Answered for a caller rather than about the namespace in the abstract.
	 *
	 * <p>A business's own slug is not taken <em>from it</em>, so reporting it as unavailable to the
	 * person who holds it would be a wrong answer rather than a conservative one. Asked here rather
	 * than corrected by the client, which would be this rule re-implemented across the wire.
	 *
	 * @return whether the slug can currently be taken by this owner. A snapshot, not a
	 *         reservation — two callers may hold the same answer at once, and the unique index
	 *         decides.
	 */
	@Transactional(readOnly = true)
	public boolean isSlugAvailableFor(UUID ownerUserId, String slug) {
		return !repository.existsBySlugAndOwnerUserIdNot(slug, ownerUserId);
	}

	/**
	 * Creates the draft that onboarding steps 1 and 2 add up to.
	 *
	 * <p>Both pre-checks exist for the error message, not for the guarantee — the unique indexes
	 * are the guarantee, because another transaction can commit between the check and the insert.
	 *
	 * <p>Which of the two indexes fired is read out of the violation rather than guessed. A
	 * double-click on the wizard's own button breaks the owner index; told "that slug is taken" the
	 * client goes looking for another name, and every other name fails exactly the same way.
	 */
	@Transactional
	public BusinessDetails create(UUID ownerUserId, BusinessInput input) {
		requireKnownState(input.address().state());
		requireKnownTimeZone(input.timeZone());

		if (repository.existsByOwnerUserId(ownerUserId)) {
			throw new BusinessAlreadyExistsException();
		}
		if (repository.existsBySlug(input.slug())) {
			throw new SlugTakenException(input.slug());
		}

		try {
			return repository.saveAndFlush(new BusinessProfile(ownerUserId, input, locate(input))).toDetails();
		}
		catch (DataIntegrityViolationException lostTheRace) {
			if (Violations.broke(lostTheRace, Violations.BUSINESS_BY_OWNER)) {
				throw new BusinessAlreadyExistsException();
			}
			if (Violations.broke(lostTheRace, Violations.BUSINESS_BY_SLUG)) {
				throw new SlugTakenException(input.slug());
			}

			throw lostTheRace;
		}
	}

	/**
	 * Replaces steps 1 and 2 wholesale.
	 *
	 * <p>The version is compared by hand, and that is not redundant with {@code @Version}.
	 * Hibernate's check protects two concurrent <em>transactions</em>; it says nothing about a
	 * client that read the profile ten minutes ago in another browser tab, whose overwrite would go
	 * through because by then the entity's version is the current one.
	 *
	 * @param timeZoneChangeConfirmed the caller's answer to "this moves your calendar". A
	 *        parameter of the call rather than a field of {@link BusinessInput}, for the same
	 *        reason {@code expectedVersion} is one: it describes this request, not the business.
	 *        Only consulted when the zone actually changes and there is a working week to move
	 * @throws UnconfirmedTimeZoneChangeException if it was needed and not given
	 */
	@Transactional
	public Optional<BusinessDetails> replace(UUID ownerUserId, long expectedVersion, BusinessInput input,
			boolean timeZoneChangeConfirmed) {
		requireKnownState(input.address().state());
		requireKnownTimeZone(input.timeZone());

		Optional<BusinessProfile> found = repository.findByOwnerUserId(ownerUserId);
		if (found.isEmpty()) {
			return Optional.empty();
		}

		BusinessProfile profile = found.get();
		if (profile.version() != expectedVersion) {
			// Not "expected 3, stored is 5": handing back the stored version invites a retry with
			// it, and that retry overwrites precisely the change this was warning about.
			throw new StaleVersionException(
					"Your profile changed since you loaded it. Reload and apply your edit again.");
		}

		// Asked here for its position in the order, not because this is where the rule lives: it
		// belongs to the transition and is enforced inside `apply` a few lines down, whichever
		// caller gets there. Ahead of the time zone question because a request that changes both
		// would otherwise be sent back to confirm a calendar move and then refused anyway.
		profile.requireSlugStillOpen(input.slug());
		requireTimeZoneChangeConfirmed(profile, input, timeZoneChangeConfirmed);

		// Only when the slug is actually moving. An update is a full replacement, so the stored
		// slug arrives back unchanged on nearly every save of steps 1 and 2 — and for a published
		// profile the line above has just proved it is identical. The unique index is what makes
		// this safe to skip: a real collision still comes back as the violation caught below.
		if (profile.slugWouldMove(input.slug())
				&& repository.existsBySlugAndOwnerUserIdNot(input.slug(), ownerUserId)) {
			throw new SlugTakenException(input.slug());
		}

		// Read before the change, because that is the question: what was this profile meeting a
		// moment ago, and is it still. Cheap for a draft, which is most saves — `bookableChecks`
		// answers on the status without running the checklist at all.
		Set<ReadinessCheckCode> wasPassing = publishing.bookableChecks(profile.id(), profile.status());

		profile.apply(input, locate(input));

		BusinessDetails saved;
		try {
			saved = repository.saveAndFlush(profile).toDetails();
		}
		catch (DataIntegrityViolationException lostTheRace) {
			// Only the slug index is reachable from here: this path updates a row rather than
			// inserting one, so the owner it already has cannot collide with itself.
			if (Violations.broke(lostTheRace, Violations.BUSINESS_BY_SLUG)) {
				throw new SlugTakenException(input.slug());
			}

			throw lostTheRace;
		}

		// After the write, so the checklist reads the profile as it would stand. Until
		// ADDRESS_GEOCODED there was nothing here for it to catch — none of the other conditions
		// live in steps 1 and 2 — and a live profile whose postal code stopped resolving would
		// have stayed published, complete-looking, and in no radius search at all. Throwing rolls
		// the address back with the transaction.
		publishing.requireStillBookable(profile.id(), wasPassing);

		return Optional.of(saved);
	}

	/**
	 * "Yes, move my calendar" — asked once, and only where there is an answer worth having.
	 *
	 * <p>Two things have to be true before it is worth asking, checked in the order that costs
	 * least. The zone has to be actually changing, and the business has to have a working week at
	 * all — that is the only thing a zone change moves, since time off and accepted appointments are
	 * instants and stay exactly where they are.
	 */
	private void requireTimeZoneChangeConfirmed(BusinessProfile profile, BusinessInput input, boolean confirmed) {
		if (confirmed || profile.timeZone().equals(input.timeZone())) {
			return;
		}
		if (!calendar.hasWorkingHours(profile.id())) {
			return;
		}

		throw new UnconfirmedTimeZoneChangeException(profile.timeZone(), input.timeZone());
	}
}
