package com.tradeties.business.internal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.OnboardingStep;
import com.tradeties.business.ReadinessCheckCode;
import com.tradeties.business.TradeOption;
import com.tradeties.business.TradeSelection;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding step 3: which trades a business holds.
 */
@Service
public class TradeSelectionService {

	private final BusinessProfileRepository businesses;
	private final BusinessTradeRepository links;
	private final CatalogTradeRepository catalog;
	private final ServiceOfferingRepository services;
	private final ServiceRemoval removal;
	private final PublishService publishing;

	TradeSelectionService(BusinessProfileRepository businesses,
			BusinessTradeRepository links,
			CatalogTradeRepository catalog,
			ServiceOfferingRepository services,
			ServiceRemoval removal,
			PublishService publishing) {

		this.businesses = businesses;
		this.links = links;
		this.catalog = catalog;
		this.services = services;
		this.removal = removal;
		this.publishing = publishing;
	}

	@Transactional(readOnly = true)
	public Optional<TradeSelection> findByOwner(UUID ownerUserId) {
		return businesses.findByOwnerUserId(ownerUserId)
				.map(business -> toSelection(links.findByIdBusinessIdAndDeletedAtIsNull(business.id())));
	}

	/**
	 * Replaces the whole selection. Three things make this more than a delete-and-reinsert, and
	 * none of them is optional.
	 *
	 * <p>First, <strong>nothing is destroyed</strong>. A trade that leaves is stamped retired and
	 * so are the services filed under it — which is what the caller sees as removal, because both
	 * drop out of every read. The rows survive. A service row is the only record that this work
	 * was offered under this name at this price, and unticking a checkbox must not be able to
	 * spend it.
	 *
	 * <p>Second, <strong>the rows that stay must stay</strong>, and a row coming back is the same
	 * row. The primary key is {@code (business_id, trade_id)}, so a re-ticked trade cannot be
	 * inserted a second time — it is the retired link revived. Its services stay retired: they
	 * were removed, and getting the trade back is not a claim about them.
	 *
	 * <p>Third, <strong>the primary flag has to be cleared before it is moved</strong>. A partial
	 * unique index allows one live primary trade per business, so setting the new one while the
	 * old one still holds the flag violates it. Clearing all of them first and flushing means the
	 * intermediate state — no primary at all — is one the index permits.
	 *
	 * @return empty if the caller has no business yet
	 */
	@Transactional
	public Optional<TradeSelection> replaceForOwner(UUID ownerUserId, UUID primaryTradeId, List<UUID> additionalTradeIds) {

		// The contract makes primaryTradeId required, but this is a public method, and a null would
		// otherwise travel two more calls before failing as an NPE inside a catalogue lookup, where
		// nothing names the field that was missing.
		Objects.requireNonNull(primaryTradeId, "primaryTradeId: a submitted step 3 has exactly one");

		Optional<BusinessProfile> found = businesses.findByOwnerUserId(ownerUserId);
		if (found.isEmpty()) {
			return Optional.empty();
		}
		BusinessProfile business = found.get();
		UUID businessId = business.id();

		// Read before anything is written, and that is the whole point of asking twice. What is
		// refused below is a change that takes a live profile off the air — not the state of being
		// live and already failing, which is somebody on their way to putting it right and would
		// have nowhere left to do it from. Hence the conditions rather than a yes or no: it is the
		// ones this profile was meeting that this change may not break.
		Set<ReadinessCheckCode> wasPassing = publishing.bookableChecks(businessId, business.status());

		Set<UUID> additional = new LinkedHashSet<>(additionalTradeIds == null ? List.of() : additionalTradeIds);
		if (additional.contains(primaryTradeId)) {
			throw new InvalidSelectionException("The primary trade must not appear among the additional trades");
		}

		Set<UUID> desired = new LinkedHashSet<>();
		desired.add(primaryTradeId);
		desired.addAll(additional);
		Map<UUID, CatalogTrade> selectable = requireSelectable(desired);

		// Retired links included: one of them may be the trade being re-ticked, and it is the row
		// that already owns the primary key.
		List<BusinessTradeLink> existing = links.findByIdBusinessId(businessId);

		// No primary anywhere first, so the partial unique index cannot object to what follows.
		existing.forEach(link -> link.markPrimary(false));
		links.saveAll(existing);
		links.flush();

		Instant now = Instant.now();

		// Only what actually leaves, and only what had not already left. Re-stamping a link the
		// business gave up two months ago would move the date of an event that happened then.
		List<BusinessTradeLink> leaving = existing.stream()
				.filter(link -> !link.isRetired())
				.filter(link -> !desired.contains(link.tradeId()))
				.toList();

		leaving.forEach(link -> link.retire(now));

		// Retired with them, because a service cannot be offered under a trade the business no
		// longer claims.
		removeServicesOf(businessId, leaving.stream().map(BusinessTradeLink::tradeId).toList());

		links.saveAll(leaving);
		links.flush();

		Map<UUID, BusinessTradeLink> byTrade = existing.stream()
				.collect(java.util.stream.Collectors.toMap(BusinessTradeLink::tradeId, Function.identity()));

		List<BusinessTradeLink> result = new ArrayList<>();
		for (UUID tradeId : desired) {
			boolean primary = tradeId.equals(primaryTradeId);
			BusinessTradeLink held = byTrade.get(tradeId);

			// `restore` on a link that was never retired only sets the flag, which is what a kept
			// trade needs anyway — so the two cases are one line rather than a branch that has to
			// stay in step with itself.
			if (held != null) {
				held.restore(primary);
				result.add(held);
			}
			else {
				result.add(new BusinessTradeLink(businessId, tradeId, primary));
			}
		}

		links.saveAll(result);
		links.flush();

		// After every write this step makes, so the checklist reads the selection as it would
		// stand.
		publishing.requireStillBookable(businessId, wasPassing);

		// Last, and after the answer is built: the marker is a note about the form, and reading
		// anything from the profile after this would read a copy that predates it.
		Map<UUID, TradeOption> options = selectable.entrySet().stream()
				.collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().toOption()));
		TradeSelection selection = toSelection(result, options);
		businesses.advanceOnboardingStep(businessId, OnboardingStep.TRADES.number());

		return Optional.of(selection);
	}

	/**
	 * The services the departing trades take with them, removed by {@link ServiceRemoval} — the
	 * same rule the catalogue's own delete follows, rather than a second one.
	 *
	 * <p>One locking query and one flush for the whole selection, not one of each per trade: each
	 * flush walks the entire persistence context, which by the last trade holds every link and
	 * every service the earlier ones loaded.
	 *
	 * <p>Flushed at all so the checklist read afterwards sees what this did.
	 */
	private void removeServicesOf(UUID businessId, List<UUID> tradeIds) {
		if (tradeIds.isEmpty()) {
			return;
		}

		removal.removeAll(services.lockByBusinessIdAndTradeIdIn(businessId, tradeIds));
		services.flush();
	}

	/**
	 * Every chosen trade must exist and still be on offer. An inactive trade is one taken off
	 * the market — existing profiles keep it, but nobody picks it up again.
	 *
	 * @return the trades found, keyed by id — the caller already needs the catalogue row for
	 *         each id it just validated, so handing it back here saves a second identical lookup
	 */
	private Map<UUID, CatalogTrade> requireSelectable(Set<UUID> tradeIds) {
		Map<UUID, CatalogTrade> found = catalog.findAllById(tradeIds).stream()
				.collect(java.util.stream.Collectors.toMap(CatalogTrade::id, Function.identity()));

		for (UUID tradeId : tradeIds) {
			CatalogTrade trade = found.get(tradeId);
			if (trade == null) {
				throw new InvalidSelectionException("No such trade: " + tradeId);
			}
			if (!trade.isActive()) {
				throw new InvalidSelectionException("That trade is no longer on offer: " + tradeId);
			}
		}

		return found;
	}

	private TradeSelection toSelection(List<BusinessTradeLink> held) {
		Map<UUID, TradeOption> options = catalog
				.findAllById(held.stream().map(BusinessTradeLink::tradeId).toList()).stream()
				.collect(java.util.stream.Collectors.toMap(CatalogTrade::id, CatalogTrade::toOption));

		return toSelection(held, options);
	}

	private TradeSelection toSelection(List<BusinessTradeLink> held, Map<UUID, TradeOption> options) {
		TradeOption primary = held.stream()
				.filter(BusinessTradeLink::isPrimary)
				.findFirst()
				.map(link -> options.get(link.tradeId()))
				.orElse(null);

		List<TradeOption> additional = held.stream()
				.filter(link -> !link.isPrimary())
				.map(link -> options.get(link.tradeId()))
				.filter(java.util.Objects::nonNull)
				.sorted(java.util.Comparator.comparing(TradeOption::displayName))
				.toList();

		return new TradeSelection(primary, additional);
	}
}
