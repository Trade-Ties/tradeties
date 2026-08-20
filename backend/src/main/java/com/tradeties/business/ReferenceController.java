package com.tradeties.business;

import java.util.List;

import com.tradeties.business.internal.ReferenceService;
import com.tradeties.generated.api.ReferenceApi;
import com.tradeties.generated.model.Trade;
import com.tradeties.generated.model.UsState;
import com.tradeties.generated.model.UsTimeZone;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * The three catalogues, served unauthenticated: a list of trades, a list of US states and a list
 * of IANA time zones reveal nothing about anybody, and the customer-side search will need the
 * trades without a token.
 *
 * <p>The exception has to be declared twice — {@code security: []} in the contract, and a
 * {@code permitAll} in {@code SecurityConfig}, which otherwise denies by default. Only the second
 * one actually opens the door; the first only says so.
 */
@RestController
class ReferenceController implements ReferenceApi {

	private final ReferenceService referenceService;

	ReferenceController(ReferenceService referenceService) {
		this.referenceService = referenceService;
	}

	@Override
	public ResponseEntity<List<Trade>> listTrades() {

		List<Trade> trades = referenceService.activeTrades().stream()
				.map(ReferenceController::toWire)
				.toList();

		return ResponseEntity.ok(trades);
	}

	@Override
	public ResponseEntity<List<UsState>> listUsStates() {

		List<UsState> states = referenceService.allStates().stream()
				.map(ReferenceController::toWire)
				.toList();

		return ResponseEntity.ok(states);
	}

	@Override
	public ResponseEntity<List<UsTimeZone>> listTimeZones() {

		List<UsTimeZone> zones = referenceService.allTimeZones().stream()
				.map(ReferenceController::toWire)
				.toList();

		return ResponseEntity.ok(zones);
	}

	static Trade toWire(TradeOption option) {
		return new Trade()
				.id(option.id())
				.code(option.code())
				.displayName(option.displayName());
	}

	private static UsState toWire(StateOption option) {
		return new UsState()
				.code(option.code())
				.name(option.name());
	}

	private static UsTimeZone toWire(TimeZoneOption option) {
		return new UsTimeZone()
				.code(option.code())
				.displayName(option.displayName());
	}
}
