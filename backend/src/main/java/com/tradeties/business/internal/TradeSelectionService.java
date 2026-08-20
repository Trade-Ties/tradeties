package com.tradeties.business.internal;

import java.util.ArrayList;
import java.util.HashSet;
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

	TradeSelectionService(BusinessProfileRepository businesses,
			BusinessTradeRepository links,
			CatalogTradeRepository catalog) {

		this.businesses = businesses;
		this.links = links;
		this.catalog = catalog;
	}

	@Transactional(readOnly = true)
	public Optional<TradeSelection> findByOwner(UUID ownerUserId) {
		return businesses.findByOwnerUserId(ownerUserId)
				.map(business -> toSelection(links.findByIdBusinessId(business.id())));
	}

	/**
	 * Replaces the whole selection. Two things make this more than a delete-and-reinsert.
	 *
	 * <p>First, <strong>the rows that stay must stay</strong>. {@code business_service} has a
	 * composite foreign key onto this table with {@code ON DELETE SET NULL (trade_id)}, so deleting
	 * every link and putting them back would silently unfile every service from its trade —
	 * including the trades the tradesperson kept. Only what actually leaves is deleted.
	 *
	 * <p>Second, <strong>the primary flag has to be cleared before it is moved</strong>. A partial
	 * unique index allows one primary trade per business, so setting the new one while the old one
	 * still holds the flag violates it. Clearing all of them first and flushing means the
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
		UUID businessId = found.get().id();

		Set<UUID> additional = new LinkedHashSet<>(additionalTradeIds == null ? List.of() : additionalTradeIds);
		if (additional.contains(primaryTradeId)) {
			throw new InvalidSelectionException("The primary trade must not appear among the additional trades");
		}

		Set<UUID> desired = new LinkedHashSet<>();
		desired.add(primaryTradeId);
		desired.addAll(additional);
		Map<UUID, CatalogTrade> selectable = requireSelectable(desired);

		List<BusinessTradeLink> current = links.findByIdBusinessId(businessId);

		// No primary anywhere first, so the partial unique index cannot object to what follows.
		current.forEach(link -> link.markPrimary(false));
		links.saveAll(current);
		links.flush();

		// Only what actually leaves, so surviving services keep their trade.
		List<BusinessTradeLink> removed = current.stream()
				.filter(link -> !desired.contains(link.tradeId()))
				.toList();
		links.deleteAll(removed);
		links.flush();

		Set<UUID> kept = current.stream()
				.filter(link -> desired.contains(link.tradeId()))
				.map(BusinessTradeLink::tradeId)
				.collect(HashSet::new, Set::add, Set::addAll);

		List<BusinessTradeLink> result = new ArrayList<>();
		for (UUID tradeId : desired) {
			boolean primary = tradeId.equals(primaryTradeId);
			if (kept.contains(tradeId)) {
				current.stream()
						.filter(link -> link.tradeId().equals(tradeId))
						.findFirst()
						.ifPresent(link -> {
							link.markPrimary(primary);
							result.add(link);
						});
			}
			else {
				result.add(new BusinessTradeLink(businessId, tradeId, primary));
			}
		}

		links.saveAll(result);
		links.flush();

		// Last, and after the answer is built: the marker is a note about the form, and reading
		// anything from the profile after this would read a copy that predates it.
		Map<UUID, TradeOption> options = selectable.entrySet().stream()
				.collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().toOption()));
		TradeSelection selection = toSelection(result, options);
		businesses.advanceOnboardingStep(businessId, OnboardingStep.TRADES.number());

		return Optional.of(selection);
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
