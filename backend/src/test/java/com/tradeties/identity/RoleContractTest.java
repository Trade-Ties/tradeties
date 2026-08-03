package com.tradeties.identity;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import com.tradeties.generated.model.MarketplaceRole;

import org.junit.jupiter.api.Test;

/**
 * Holds the domain enums and the generated wire enums in lockstep.
 *
 * <p>{@code IdentityController} maps between them with {@code valueOf}, which fails at
 * runtime — on a real request, for a real user — if someone edits {@code openapi.yaml} and
 * removes a value. These tests move that failure to build time, which is the only reason
 * keeping two parallel enums is defensible at all.
 */
class RoleContractTest {

	@Test
	void everyDomainRoleCanBeSentOverTheWire() {
		for (Role role : Role.values()) {
			assertDoesNotThrow(() -> MarketplaceRole.valueOf(role.name()),
					"Role." + role.name() + " has no MarketplaceRole in api/openapi.yaml");
		}
	}

	@Test
	void everyWireRoleHasADomainCounterpart() {
		for (MarketplaceRole role : MarketplaceRole.values()) {
			assertDoesNotThrow(() -> Role.valueOf(role.name()),
					"MarketplaceRole." + role.name() + " has no Role in the domain model");
		}
	}

	@Test
	void everyWireIntentHasADomainCounterpart() {
		for (com.tradeties.generated.model.RegistrationIntent intent
				: com.tradeties.generated.model.RegistrationIntent.values()) {

			assertDoesNotThrow(() -> RegistrationIntent.valueOf(intent.name()),
					"The contract offers intent " + intent.name() + ", which the domain cannot grant");
		}
	}
}