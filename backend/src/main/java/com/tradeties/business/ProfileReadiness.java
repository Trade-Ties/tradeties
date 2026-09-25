package com.tradeties.business;

import java.util.List;

/**
 * Always complete, passing entries included. A list that only carried problems could be
 * displayed but not ticked off, and "nothing left" would be indistinguishable from "nothing
 * checked".
 */
public record ProfileReadiness(List<ReadinessCheck> checks) {

	public ProfileReadiness {
		checks = checks == null ? List.of() : List.copyOf(checks);
	}

	/**
	 * Every condition met. Advice is deliberately not counted: it is a suggestion about being
	 * found rather than a requirement for being booked, and a checklist that refused to publish
	 * over it would be a rule wearing a hint's clothes.
	 */
	public boolean ready() {
		return checks.stream().filter(ReadinessCheck::blocking).allMatch(ReadinessCheck::passed);
	}
}
