package com.tradeties.business;

import java.util.UUID;

/**
 * <strong>Declared here and implemented in {@code availability}.</strong> That module already
 * depends on {@code business} to resolve which business a caller owns, so depending back on it
 * for this question would close a cycle, which Spring Modulith rejects. The consumer owns the
 * interface, the provider implements it, and the dependency still runs one way.
 *
 * <p>Deliberately narrow: "is there any working time at all" is the whole question the checklist
 * asks. A port that grew to expose the calendar would make {@code business} a client of it, which
 * is the coupling this shape exists to avoid.
 */
public interface CalendarReadiness {

	boolean hasWorkingHours(UUID businessId);
}
