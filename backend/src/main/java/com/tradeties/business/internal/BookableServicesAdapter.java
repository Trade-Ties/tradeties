package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.BookableService;
import com.tradeties.business.BookableServices;
import com.tradeties.business.BusinessDetails;
import com.tradeties.business.PricingTerms;
import com.tradeties.business.ServiceDetails;
import com.tradeties.business.ServicePricingMode;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Answers {@code job}'s one question out of the same three tables the public profile is built
 * from, and in one transaction.
 *
 * <p>The single read is the point rather than an optimisation. The duration, the price and the
 * cancellation terms are copied onto a request together and have to describe one version of the
 * profile; read separately, an edit landing between them would freeze a fee from before it and a
 * rate from after.
 */
@Service
class BookableServicesAdapter implements BookableServices {

	private final BusinessSearchRepository businesses;
	private final ServiceOfferingRepository services;
	private final BusinessPricingRepository pricing;

	BookableServicesAdapter(BusinessSearchRepository businesses,
			ServiceOfferingRepository services,
			BusinessPricingRepository pricing) {

		this.businesses = businesses;
		this.services = services;
		this.pricing = pricing;
	}

	@Override
	@Transactional(readOnly = true)
	public boolean isPublished(String slug) {
		return businesses.findPublishedBySlug(slug).isPresent();
	}

	@Override
	@Transactional(readOnly = true)
	public Optional<BookableService> find(String slug, UUID serviceId) {
		return businesses.findPublishedBySlug(slug).flatMap(business -> services
				.findByIdAndBusinessId(serviceId, business.id())
				.filter(ServiceOffering::isActive)
				.map(offering -> assemble(business, offering)));
	}

	/**
	 * Terms are always present on a published profile — {@code PRICING_SET} is a publishing
	 * condition, and its reason is this one: a request snapshots the cancellation fee as it is
	 * sent, so a business with no terms has nothing that could be asked of it.
	 */
	private BookableService assemble(BusinessProfile business, ServiceOffering offering) {
		BusinessDetails details = business.toDetails();
		ServiceDetails service = offering.toDetails();

		PricingTerms terms = pricing.findById(business.id())
				.map(BusinessPricing::toTerms)
				.orElseThrow(() -> new IllegalStateException(
						"Published business " + business.id() + " has no pricing terms"));

		return new BookableService(
				business.id(),
				details.slug(),
				details.displayName(),
				business.timeZone(),
				service.id(),
				service.tradeId(),
				service.name(),
				service.estimatedDurationMinutes(),
				service.pricingMode(),
				service.price(),
				terms.hourlyRate(),
				effectiveHourlyRate(service, terms),
				terms.serviceCallFee(),
				terms.cancellationFee(),
				terms.cancellationNoticeHours(),
				terms.currency());
	}

	/**
	 * The rate that actually applies, resolved once here so nothing downstream has to.
	 *
	 * <p>An hourly service may carry a rate of its own and it overrides the general one — that is
	 * what an emergency call-out at a higher tariff is. Any other pricing mode has no hourly rate
	 * at all, and null there is the truth rather than a missing lookup.
	 */
	private static BigDecimal effectiveHourlyRate(ServiceDetails service, PricingTerms terms) {
		if (service.pricingMode() != ServicePricingMode.HOURLY) {
			return null;
		}

		return service.price() != null ? service.price() : terms.hourlyRate();
	}
}
