package com.tradeties.business.internal;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.LicenseAlreadyExistsException;
import com.tradeties.business.LicenseDefinition;
import com.tradeties.business.LicenseDetails;
import com.tradeties.business.OnboardingStep;
import com.tradeties.business.StaleVersionException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding step 6: the licences a business holds.
 */
@Service
public class LicenseService {

	/**
	 * Longest-lived first, and the ones with no expiry date last.
	 *
	 * <p>Descending with nulls last is not what a plain {@code ORDER BY ... DESC} does in
	 * PostgreSQL — there, nulls sort first — so a licence with no expiry would head the list.
	 * Sorting in memory is honest here: a business holds a handful of licences, not a page of
	 * them.
	 */
	private static final Comparator<BusinessLicense> BY_EXPIRY =
			Comparator.comparing(BusinessLicense::expiresOn,
					Comparator.nullsLast(Comparator.reverseOrder()));

	private final BusinessProfileRepository businesses;
	private final BusinessLicenseRepository licenses;
	private final CatalogStateRepository states;

	LicenseService(BusinessProfileRepository businesses,
			BusinessLicenseRepository licenses,
			CatalogStateRepository states) {

		this.businesses = businesses;
		this.licenses = licenses;
		this.states = states;
	}

	@Transactional(readOnly = true)
	public Optional<List<LicenseDetails>> findByOwner(UUID ownerUserId) {
		return businessIdOf(ownerUserId)
				.map(businessId -> licenses.findByBusinessId(businessId).stream()
						.sorted(BY_EXPIRY)
						.map(BusinessLicense::toDetails)
						.toList());
	}

	@Transactional
	public Optional<LicenseDetails> addForOwner(UUID ownerUserId, LicenseDefinition definition) {
		Optional<UUID> businessId = businessIdOf(ownerUserId);
		if (businessId.isEmpty()) {
			return Optional.empty();
		}
		UUID business = businessId.get();

		requireKnownState(definition.state());
		requireSaneDates(definition);
		if (licenses.existsByBusinessIdAndStateAndLicenseNumber(
				business, definition.state(), definition.licenseNumber())) {

			throw new LicenseAlreadyExistsException(definition.state(), definition.licenseNumber());
		}

		LicenseDetails created = save(new BusinessLicense(business, definition), definition);
		recordStepReached(business);

		return Optional.of(created);
	}

	@Transactional
	public Optional<LicenseDetails> replaceForOwner(UUID ownerUserId, UUID licenseId, long expectedVersion,
			LicenseDefinition definition) {

		Optional<UUID> businessId = businessIdOf(ownerUserId);
		if (businessId.isEmpty()) {
			return Optional.empty();
		}
		UUID business = businessId.get();

		Optional<BusinessLicense> found = licenses.findByIdAndBusinessId(licenseId, business);
		if (found.isEmpty()) {
			return Optional.empty();
		}

		BusinessLicense license = found.get();
		if (license.version() != expectedVersion) {
			throw new StaleVersionException(
					"This licence changed since you loaded it. Reload and apply your edit again.");
		}

		requireKnownState(definition.state());
		requireSaneDates(definition);
		if (licenses.existsByBusinessIdAndStateAndLicenseNumberAndIdNot(
				business, definition.state(), definition.licenseNumber(), licenseId)) {

			throw new LicenseAlreadyExistsException(definition.state(), definition.licenseNumber());
		}

		// Withdraws verifiedAt if what was verified has changed — see BusinessLicense#apply.
		license.apply(definition);

		LicenseDetails replaced = save(license, definition);
		recordStepReached(business);

		return Optional.of(replaced);
	}

	/** Nothing points at a licence, so this really deletes rather than deactivating. */
	@Transactional
	public boolean removeForOwner(UUID ownerUserId, UUID licenseId) {
		Optional<UUID> businessId = businessIdOf(ownerUserId);
		if (businessId.isEmpty()) {
			return false;
		}
		UUID business = businessId.get();

		Optional<BusinessLicense> found = licenses.findByIdAndBusinessId(licenseId, business);
		if (found.isEmpty()) {
			return false;
		}

		licenses.delete(found.get());
		recordStepReached(business);

		return true;
	}

	/**
	 * The contract's pattern only says "two upper-case letters", so {@code XX} passes it and then
	 * fails the foreign key — a 500 about a constraint name. This check exists for the message.
	 */
	private void requireKnownState(String state) {
		if (!states.existsById(state)) {
			throw new InvalidSelectionException("No such US state: " + state);
		}
	}

	/**
	 * A licence cannot expire before it was issued. The database says the same thing, but a
	 * constraint violation arriving here would be a 500 about a constraint name — and the
	 * contract cannot express a comparison between two fields.
	 */
	private static void requireSaneDates(LicenseDefinition definition) {
		LocalDate issued = definition.issuedOn();
		LocalDate expires = definition.expiresOn();

		if (issued != null && expires != null && expires.isBefore(issued)) {
			throw new InvalidSelectionException(
					"A licence cannot expire (" + expires + ") before it was issued (" + issued + ")");
		}
	}

	private LicenseDetails save(BusinessLicense license, LicenseDefinition definition) {
		try {
			return licenses.saveAndFlush(license).toDetails();
		}
		catch (DataIntegrityViolationException lostTheRace) {
			if (Violations.broke(lostTheRace, Violations.LICENSE_BY_NUMBER)) {
				throw new LicenseAlreadyExistsException(definition.state(), definition.licenseNumber());
			}

			throw lostTheRace;
		}
	}

	/**
	 * Step 6 is the one step of the wizard that can legitimately be left empty — a tradesperson
	 * who holds no licence has nothing to enter here. Only a write records it, so somebody who
	 * looks at the form and moves on reaches 6 by saving step 7 instead. That is the honest
	 * answer: the marker says what was saved, and nothing was.
	 */
	private void recordStepReached(UUID businessId) {
		businesses.advanceOnboardingStep(businessId, OnboardingStep.LICENSES.number());
	}

	private Optional<UUID> businessIdOf(UUID ownerUserId) {
		return businesses.findByOwnerUserId(ownerUserId).map(BusinessProfile::id);
	}
}
