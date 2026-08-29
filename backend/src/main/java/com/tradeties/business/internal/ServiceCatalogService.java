package com.tradeties.business.internal;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.OnboardingStep;
import com.tradeties.business.ReadinessCheckCode;
import com.tradeties.business.ServiceDefinition;
import com.tradeties.business.ServiceDetails;
import com.tradeties.business.ServiceNameTakenException;
import com.tradeties.business.StaleVersionException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding step 4: what a business offers.
 */
@Service
public class ServiceCatalogService {

	/**
	 * Positions are spaced so a service can later be slotted between two others without
	 * renumbering the rest — the same reason the trade catalogue counts in tens.
	 */
	private static final int ORDER_SPACING = 10;

	private final BusinessProfileRepository businesses;
	private final ServiceOfferingRepository services;
	private final BusinessTradeRepository trades;
	private final ServiceRemoval removal;
	private final PublishService publishing;

	ServiceCatalogService(BusinessProfileRepository businesses,
			ServiceOfferingRepository services,
			BusinessTradeRepository trades,
			ServiceRemoval removal,
			PublishService publishing) {

		this.businesses = businesses;
		this.services = services;
		this.trades = trades;
		this.removal = removal;
		this.publishing = publishing;
	}

	@Transactional(readOnly = true)
	public Optional<List<ServiceDetails>> findByOwner(UUID ownerUserId) {
		return businessIdOf(ownerUserId)
				.map(businessId -> services.findByBusinessIdOrderBySortOrderAscCreatedAtAsc(businessId).stream()
						.map(ServiceOffering::toDetails)
						.toList());
	}

	@Transactional
	public Optional<ServiceDetails> addForOwner(UUID ownerUserId, ServiceDefinition definition) {
		Optional<UUID> businessId = businessIdOf(ownerUserId);
		if (businessId.isEmpty()) {
			return Optional.empty();
		}
		UUID business = businessId.get();

		requireValidPricing(definition);
		Amounts.requirePlausible(definition);
		requireHeldTrade(business, definition.tradeId());
		if (services.existsByBusinessIdAndNameIgnoreCase(business, definition.name())) {
			throw new ServiceNameTakenException(definition.name());
		}

		// The highest position, not the count. They agree only until something is deleted, and
		// the contract promises this lands at the end of the list whatever has happened before.
		int position = services.highestSortOrder(business) + ORDER_SPACING;

		ServiceDetails created = save(new ServiceOffering(business, definition, position), definition);
		recordStepReached(business);

		return Optional.of(created);
	}

	@Transactional
	public Optional<ServiceDetails> replaceForOwner(UUID ownerUserId, UUID serviceId, long expectedVersion,
			ServiceDefinition definition) {

		Optional<UUID> businessId = businessIdOf(ownerUserId);
		if (businessId.isEmpty()) {
			return Optional.empty();
		}
		UUID business = businessId.get();

		Optional<ServiceOffering> found = services.findByIdAndBusinessId(serviceId, business);
		if (found.isEmpty()) {
			return Optional.empty();
		}

		ServiceOffering service = found.get();
		if (service.version() != expectedVersion) {
			throw new StaleVersionException(
					"This service changed since you loaded it. Reload and apply your edit again.");
		}

		requireValidPricing(definition);
		Amounts.requirePlausible(definition);
		requireHeldTrade(business, definition.tradeId());
		if (services.existsByBusinessIdAndNameIgnoreCaseAndIdNot(business, definition.name(), serviceId)) {
			throw new ServiceNameTakenException(definition.name());
		}

		service.apply(definition);

		ServiceDetails replaced = save(service, definition);
		recordStepReached(business);

		return Optional.of(replaced);
	}

	/**
	 * Either way the caller's intent — "stop offering this" — is satisfied. Which of the two
	 * happens is {@link ServiceRemoval}'s to decide, so that a trade being given up removes the
	 * services filed under it by the same rule.
	 *
	 * <p>The row is locked before it is handed over, so the answer cannot go stale between asking
	 * and acting — see {@code ServiceOfferingRepository#lockByIdAndBusinessId}.
	 */
	@Transactional
	public boolean removeForOwner(UUID ownerUserId, UUID serviceId, boolean unpublishConfirmed) {
		Optional<BusinessProfile> owned = businesses.findByOwnerUserId(ownerUserId);
		if (owned.isEmpty()) {
			return false;
		}
		BusinessProfile business = owned.get();

		Optional<ServiceOffering> found = services.lockByIdAndBusinessId(serviceId, business.id());
		if (found.isEmpty()) {
			return false;
		}

		// Read before the removal, because afterwards there is nothing left to read it from.
		Set<ReadinessCheckCode> wasPassing = publishing.bookableChecks(business.id(), business.status());

		removal.removeAll(List.of(found.get()));
		services.flush();

		// Asked rather than refused, which is the opposite of what a trade change gets and
		// deliberately so — see `unpublishIfNoLongerBookable`.
		publishing.unpublishIfNoLongerBookable(business, wasPassing, unpublishConfirmed);

		recordStepReached(business.id());
		return true;
	}

	/**
	 * The new order must name every active service exactly once. A partial list would leave the
	 * remainder in an order nobody chose, and accepting it silently would make a half-finished drag
	 * look like it worked.
	 *
	 * <p><strong>Every service is renumbered, not only the ones the client named.</strong> The named
	 * active ones take the front in the order given, and the deactivated ones follow behind, keeping
	 * the relative order they already had. Left on their old numbers they would collide with a
	 * freshly renumbered active one.
	 */
	@Transactional
	public Optional<List<ServiceDetails>> reorderForOwner(UUID ownerUserId, List<UUID> orderedIds) {
		Optional<UUID> businessId = businessIdOf(ownerUserId);
		if (businessId.isEmpty()) {
			return Optional.empty();
		}
		UUID business = businessId.get();

		// The inactive half has to keep its relative order, and taking it out of the same
		// already-sorted list is what guarantees that.
		Map<Boolean, List<ServiceOffering>> byActivity =
				services.findByBusinessIdOrderBySortOrderAscCreatedAtAsc(business).stream()
						.collect(Collectors.partitioningBy(ServiceOffering::isActive));

		List<ServiceOffering> active = byActivity.get(true);
		List<ServiceOffering> inactive = byActivity.get(false);

		Set<UUID> requested = new LinkedHashSet<>(orderedIds);
		if (requested.size() != orderedIds.size()) {
			throw new InvalidSelectionException("The new order lists the same service twice");
		}

		// Insertion-ordered, so the complaint below lists anything missing in the order the
		// catalogue itself is in rather than in whatever order hashing produced.
		Set<UUID> expected = active.stream().map(ServiceOffering::id)
				.collect(Collectors.toCollection(LinkedHashSet::new));

		if (!requested.equals(expected)) {
			throw new InvalidSelectionException(explainOrderMismatch(expected, requested));
		}

		// The whole catalogue in its new order, built once: numbering, saving and answering all read
		// from this one list, so the three cannot disagree.
		Map<UUID, ServiceOffering> byId = active.stream()
				.collect(Collectors.toMap(ServiceOffering::id, Function.identity()));

		List<ServiceOffering> reordered = new ArrayList<>(orderedIds.size() + inactive.size());
		orderedIds.forEach(id -> reordered.add(byId.get(id)));
		reordered.addAll(inactive);

		int position = ORDER_SPACING;
		for (ServiceOffering service : reordered) {
			service.moveTo(position);
			position += ORDER_SPACING;
		}

		services.saveAllAndFlush(reordered);

		List<ServiceDetails> ordered = reordered.stream().map(ServiceOffering::toDetails).toList();
		recordStepReached(business);

		return Optional.of(ordered);
	}

	/**
	 * Counting says nothing — a list of the right length with one wrong id reads "expected 3, got
	 * 3" — and the ids are the only handle the client has on a service.
	 */
	private static String explainOrderMismatch(Set<UUID> expected, Set<UUID> requested) {
		Set<UUID> missing = new LinkedHashSet<>(expected);
		missing.removeAll(requested);

		Set<UUID> unknown = new LinkedHashSet<>(requested);
		unknown.removeAll(expected);

		StringBuilder complaint =
				new StringBuilder("The new order must name every active service exactly once.");

		if (!missing.isEmpty()) {
			complaint.append(" Missing: ").append(join(missing)).append('.');
		}
		if (!unknown.isEmpty()) {
			complaint.append(" Not an active service of this business: ").append(join(unknown)).append('.');
		}

		return complaint.toString();
	}

	private static String join(Set<UUID> ids) {
		return ids.stream().map(UUID::toString).collect(Collectors.joining(", "));
	}

	/**
	 * Step 4 is reached by any successful write to the catalogue, a removal included. The
	 * tradesperson is standing on that form either way, and the marker records where they are,
	 * not what they decided while they were there.
	 */
	private void recordStepReached(UUID businessId) {
		businesses.advanceOnboardingStep(businessId, OnboardingStep.SERVICES.number());
	}

	/**
	 * The contract cannot say this — "required for these two values of another field, forbidden
	 * for that one" needs a conditional schema — and the database's {@code CHECK} would surface as a
	 * 500 naming a constraint rather than the two fields that disagree.
	 */
	private static void requireValidPricing(ServiceDefinition definition) {
		boolean hasPrice = definition.price() != null;

		switch (definition.pricingMode()) {
			case FLAT, STARTING_AT -> {
				if (!hasPrice) {
					throw new InvalidSelectionException(
							definition.pricingMode() + " needs a price");
				}
			}
			case QUOTE_ONLY -> {
				if (hasPrice) {
					throw new InvalidSelectionException(
							"QUOTE_ONLY means the price is settled after seeing the job, so it must not carry one");
				}
			}
			case HOURLY -> {
				// A price is optional here and overrides the general hourly rate.
			}
		}
	}

	/**
	 * Every service sits under exactly one trade, and only under a trade the business actually
	 * holds. The composite foreign key guarantees both; this check is what turns the guarantee
	 * into a message that says which trade was wrong.
	 *
	 * <p>The null case is stated here as well as in the contract. These are public service
	 * methods, and a missing trade that reached the insert would arrive as a NOT NULL violation
	 * naming a column instead of a 400 naming the field.
	 */
	private void requireHeldTrade(UUID businessId, UUID tradeId) {
		if (tradeId == null) {
			throw new InvalidSelectionException("A service must name the trade it sits under");
		}
		if (!trades.existsByIdBusinessIdAndIdTradeIdAndDeletedAtIsNull(businessId, tradeId)) {
			throw new InvalidSelectionException("This business does not hold the trade " + tradeId);
		}
	}

	/**
	 * The name index is the only violation this path can explain, so it is the only one it
	 * translates. Everything else — a trade dropped from the business between the check and the
	 * insert, say — is rethrown rather than dressed up as a duplicate name that was never there.
	 */
	private ServiceDetails save(ServiceOffering service, ServiceDefinition definition) {
		try {
			return services.saveAndFlush(service).toDetails();
		}
		catch (DataIntegrityViolationException lostTheRace) {
			if (Violations.broke(lostTheRace, Violations.SERVICE_BY_NAME)) {
				throw new ServiceNameTakenException(definition.name());
			}

			throw lostTheRace;
		}
	}

	private Optional<UUID> businessIdOf(UUID ownerUserId) {
		return businesses.findByOwnerUserId(ownerUserId).map(BusinessProfile::id);
	}
}
