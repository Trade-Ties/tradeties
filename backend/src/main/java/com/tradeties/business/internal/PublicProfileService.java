package com.tradeties.business.internal;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.LicenseDetails;
import com.tradeties.business.PublicProfile;
import com.tradeties.business.ServiceDetails;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One business, read by the URL it was published under and by nobody in particular.
 *
 * <p>Apart from {@link BusinessSearchService} because it is a different question — that one takes
 * a postal code and answers with many businesses, this one takes a slug and answers with one —
 * but on the same side of the same rule: no token, no owner, and nothing in the answer that
 * identifies a person.
 *
 * <p><strong>Five reads and no join.</strong> The profile, its trades, its services, its terms
 * and its licences are five queries for one page, which is what a page of one business can
 * afford. The search does the opposite for the opposite reason: fifty businesses at a time make
 * anything per-row a hundred and fifty round trips.
 */
@Service
public class PublicProfileService {

	private final BusinessSearchRepository businesses;
	private final TradeSelectionService trades;
	private final ServiceOfferingRepository services;
	private final BusinessPricingRepository pricing;
	private final BusinessLicenseRepository licenses;

	PublicProfileService(BusinessSearchRepository businesses,
			TradeSelectionService trades,
			ServiceOfferingRepository services,
			BusinessPricingRepository pricing,
			BusinessLicenseRepository licenses) {

		this.businesses = businesses;
		this.trades = trades;
		this.services = services;
		this.pricing = pricing;
		this.licenses = licenses;
	}

	/**
	 * @return empty for a slug nobody holds, for a profile still in draft and for one the
	 *         marketplace has suspended. One answer for three states on purpose: the repository
	 *         cannot be asked for an unpublished profile at all, and telling a draft from a
	 *         suspension would publish a moderation decision to anybody who can type a URL
	 */
	@Transactional(readOnly = true)
	public Optional<PublicProfile> findBySlug(String slug) {
		return businesses.findPublishedBySlug(slug).map(this::assemble);
	}

	private PublicProfile assemble(BusinessProfile business) {
		UUID businessId = business.id();

		List<ServiceDetails> offered = services
				.findByBusinessIdAndActiveTrueOrderBySortOrderAscCreatedAtAsc(businessId).stream()
				.map(ServiceOffering::toDetails)
				.toList();

		return business.toPublicProfile(
				trades.findByBusinessId(businessId),
				offered,
				pricing.findById(businessId).map(BusinessPricing::toTerms).orElse(null),
				valid(businessId, business.timeZone()));
	}

	/**
	 * The licences worth showing: the ones that have not run out.
	 *
	 * <p>Read against the <em>business's</em> date rather than the server's. It is their licence
	 * and their day, and a profile in Denver should not lose a badge because a machine in another
	 * zone has already turned the page. The search asks the same question with {@code CURRENT_DATE}
	 * over a whole page of businesses, which is this rule at the coarser resolution that form
	 * allows; the two can differ for a few hours on the day a licence expires, on a badge.
	 */
	private List<LicenseDetails> valid(UUID businessId, String timeZone) {
		LocalDate today = LocalDate.now(ZoneId.of(timeZone));

		return licenses.findByBusinessId(businessId).stream()
				.filter(license -> license.expiresOn() == null || !license.expiresOn().isBefore(today))
				.map(BusinessLicense::toDetails)
				.toList();
	}
}
