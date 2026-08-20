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

	public boolean ready() {
		return checks.stream().allMatch(ReadinessCheck::passed);
	}
}
