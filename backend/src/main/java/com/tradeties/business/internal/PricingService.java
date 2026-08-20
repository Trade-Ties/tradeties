package com.tradeties.business.internal;

import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.OnboardingStep;
import com.tradeties.business.PricingDefinition;
import com.tradeties.business.PricingTerms;
import com.tradeties.business.StaleVersionException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding step 5: what a business charges.
 */
@Service
public class PricingService {

	private final BusinessProfileRepository businesses;
	private final BusinessPricingRepository pricing;
	private final PricingInsert inserts;

	PricingService(BusinessProfileRepository businesses, BusinessPricingRepository pricing, PricingInsert inserts) {
		this.businesses = businesses;
		this.pricing = pricing;
		this.inserts = inserts;
	}

	/**
	 * @return empty both when the caller has no business and when they have one without rates
	 *         yet. The two are the same answer to the client — a 404 that means "step 5 has
	 *         not happened".
	 */
	@Transactional(readOnly = true)
	public Optional<PricingTerms> findByOwner(UUID ownerUserId) {
		return businesses.findByOwnerUserId(ownerUserId)
				.flatMap(business -> pricing.findById(business.id()))
				.map(BusinessPricing::toTerms);
	}

	/**
	 * {@code expectedVersion} is the caller's statement about what they think is there:
	 * empty means "nothing yet", a number means "replace what I read". Both can be wrong, and
	 * both are a conflict rather than a silent overwrite — the first because somebody else
	 * already set rates, the second because they changed since.
	 *
	 * @return empty if the caller has no business yet
	 */
	@Transactional
	public Optional<PricingTerms> setForOwner(UUID ownerUserId, Long expectedVersion, PricingDefinition definition) {

		Optional<BusinessProfile> found = businesses.findByOwnerUserId(ownerUserId);
		if (found.isEmpty()) {
			return Optional.empty();
		}
		UUID businessId = found.get().id();

		requireCoherent(definition);
		Amounts.requirePlausible(definition);

		Optional<BusinessPricing> existing = pricing.findById(businessId);

		if (existing.isEmpty()) {
			if (expectedVersion != null) {
				// Their own number, echoed back — that is the client's statement, not the
				// server's, so repeating it gives nothing away.
				throw new StaleVersionException(
						"No rates are stored yet, so there is no version " + expectedVersion
								+ " to replace. Omit the version on the first write.");
			}
			PricingTerms created;
			try {
				created = inserts.insert(new BusinessPricing(businessId, definition)).toTerms();
			}
			catch (DataIntegrityViolationException somebodyElseWasFirst) {
				// The pre-check above is for the message; the primary key is the guarantee, because
				// another transaction can commit between the two. Rethrowing is the only option: this
				// transaction is marked rollback-only, and advancing the onboarding step below is
				// exactly what must not happen now.
				throw new StaleVersionException(
						"Rates were stored while you were writing yours. Reload and apply your edit again.");
			}

			businesses.advanceOnboardingStep(businessId, OnboardingStep.PRICING.number());

			return Optional.of(created);
		}

		BusinessPricing stored = existing.get();
		if (expectedVersion == null) {
			throw new StaleVersionException(
					"Rates already exist. Send the version you last read to replace them.");
		}
		if (stored.version() != expectedVersion) {
			throw new StaleVersionException(
					"Your rates changed since you loaded them. Reload and apply your edit again.");
		}

		stored.apply(definition);

		PricingTerms replaced = pricing.saveAndFlush(stored).toTerms();
		businesses.advanceOnboardingStep(businessId, OnboardingStep.PRICING.number());

		return Optional.of(replaced);
	}

	/**
	 * The combinations the schema cannot express.
	 *
	 * <p>Each is a {@code CHECK} in the database, where reaching one means a violation naming a
	 * constraint. The contract cannot express them either — "required depending on the value of
	 * another field" needs a conditional schema the generator would not turn into validation. So
	 * they are checked here, where a wrong combination can be named.
	 */
	private static void requireCoherent(PricingDefinition definition) {

		switch (definition.travelFeeMode()) {
			case INCLUDED -> {
				if (definition.travelFlatFee() != null || definition.travelRatePerMile() != null) {
					throw new InvalidSelectionException(
							"Travel is included, so neither a flat fee nor a rate per mile belongs here");
				}
			}
			case FLAT -> {
				if (definition.travelFlatFee() == null) {
					throw new InvalidSelectionException("A flat travel fee needs an amount");
				}
				if (definition.travelRatePerMile() != null) {
					throw new InvalidSelectionException("A flat travel fee cannot also have a rate per mile");
				}
			}
			case PER_MILE -> {
				if (definition.travelRatePerMile() == null) {
					throw new InvalidSelectionException("Travel per mile needs a rate");
				}
				if (definition.travelFlatFee() != null) {
					throw new InvalidSelectionException("Travel per mile cannot also have a flat fee");
				}
			}
		}

		boolean marksUp = definition.materialPricingMode() == com.tradeties.business.MaterialPricingMode.COST_PLUS_MARKUP;
		if (marksUp && definition.materialMarkupPercent() == null) {
			throw new InvalidSelectionException("Cost plus markup needs a markup percentage");
		}
		if (!marksUp && definition.materialMarkupPercent() != null) {
			throw new InvalidSelectionException(
					"A markup percentage only belongs to cost plus markup — otherwise it would sit there "
							+ "unused and reappear on the next switch");
		}

		if (definition.serviceCallFeeWaivedIfHired() && definition.serviceCallFee() == null) {
			throw new InvalidSelectionException("Waiving a service call fee that does not exist is not a statement");
		}
	}
}
