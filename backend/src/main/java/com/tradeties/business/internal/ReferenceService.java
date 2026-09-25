package com.tradeties.business.internal;

import java.util.List;

import com.tradeties.business.ServiceJob;
import com.tradeties.business.StateOption;
import com.tradeties.business.TimeZoneOption;
import com.tradeties.business.TradeOption;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deliberately not cached, obvious candidates though they are: a few dozen rows over a warm
 * connection is not worth a cache invalidation story, and the repeatable migration can change the
 * trades under a running application.
 */
@Service
public class ReferenceService {

	private final CatalogTradeRepository trades;
	private final CatalogStateRepository states;
	private final CatalogTimeZoneRepository timeZones;
	private final ServiceCatalogRepository catalogue;

	ReferenceService(CatalogTradeRepository trades,
			CatalogStateRepository states,
			CatalogTimeZoneRepository timeZones,
			ServiceCatalogRepository catalogue) {

		this.trades = trades;
		this.states = states;
		this.timeZones = timeZones;
		this.catalogue = catalogue;
	}

	@Transactional(readOnly = true)
	public List<TradeOption> activeTrades() {
		return trades.findByActiveTrueOrderBySortOrderAsc().stream()
				.map(CatalogTrade::toOption)
				.toList();
	}

		/**
	 * Every job the catalogue holds, for the picker behind onboarding step 4.
	 *
	 * <p>Reference and not per-business, so it is read once and narrowed by whoever shows it. A
	 * business filters to the trades it holds — which change on the screen before the picker, so
	 * a list filtered here would already be stale by the time it was used.
	 */
	@Transactional(readOnly = true)
	public List<ServiceJob> allServiceJobs() {
		return catalogue.findAllActive().stream()
				.map(row -> new ServiceJob(row.getId(), row.getCode(), row.getLabel(), row.getTradeId()))
				.toList();
	}

	public List<StateOption> allStates() {
		return states.findAllByOrderByNameAsc().stream()
				.map(CatalogState::toOption)
				.toList();
	}

	@Transactional(readOnly = true)
	public List<TimeZoneOption> allTimeZones() {
		return timeZones.findAllByOrderBySortOrderAsc().stream()
				.map(CatalogTimeZone::toOption)
				.toList();
	}
}
