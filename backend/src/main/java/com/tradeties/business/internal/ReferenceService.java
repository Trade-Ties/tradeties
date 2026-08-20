package com.tradeties.business.internal;

import java.util.List;

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

	ReferenceService(CatalogTradeRepository trades,
			CatalogStateRepository states,
			CatalogTimeZoneRepository timeZones) {

		this.trades = trades;
		this.states = states;
		this.timeZones = timeZones;
	}

	@Transactional(readOnly = true)
	public List<TradeOption> activeTrades() {
		return trades.findByActiveTrueOrderBySortOrderAsc().stream()
				.map(CatalogTrade::toOption)
				.toList();
	}

	@Transactional(readOnly = true)
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
