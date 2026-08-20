package com.tradeties.business.internal;

import java.util.Set;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Which rule a rejected write actually broke.
 *
 * <p>{@code DataIntegrityViolationException} is one type for everything the database refuses — a
 * duplicate, a foreign key, a check constraint, a value too wide for its column — so a
 * {@code catch} that names one of them is guessing about the rest. The guess is not harmless: a
 * double-click on "create business" breaks the owner index and used to be reported as a taken
 * slug, which sends the client looking for another name that fails exactly the same way.
 *
 * <p><strong>The violation is asked, never the database.</strong> Re-querying in the {@code catch}
 * cannot work: PostgreSQL aborts the whole transaction on a failed statement, so by then not even
 * {@code SELECT 1} is permitted. Hibernate carries the name of the broken constraint on the
 * exception, which is all that is needed.
 *
 * <p>What is <em>not</em> matched here is rethrown, deliberately. A violation no pre-check covers
 * is a bug, and a 500 in the log is what gets it looked at; a friendly 409 invented for it would
 * read as normal traffic.
 */
final class Violations {

	/** "One account, one business" — {@code V3__business_profile.sql}. */
	static final String BUSINESS_BY_OWNER = "business_profile_by_owner_uidx";

	static final String BUSINESS_BY_SLUG = "business_profile_by_slug_uidx";

	/** One service name per business, compared case-insensitively. */
	static final String SERVICE_BY_NAME = "business_service_by_name_uidx";

	/** State plus number is what identifies a licence in the real world. */
	static final String LICENSE_BY_NUMBER = "business_license_uidx";

	/**
	 * Every name above, so a test can hold them against the schema. These strings live in two files
	 * — the migration that creates the index and this one that reads it back — and a rename in a
	 * later migration would not break the build, it would quietly stop matching.
	 * {@code ViolationsTests} is what makes that loud instead.
	 */
	static final Set<String> ALL = Set.of(
			BUSINESS_BY_OWNER, BUSINESS_BY_SLUG, SERVICE_BY_NAME, LICENSE_BY_NUMBER);

	private Violations() {
	}

	/**
	 * @return whether this rejection was the named constraint and not something else. False for
	 *         anything Hibernate did not report as a constraint violation at all — a value too wide
	 *         for its column arrives as a {@code DataException}, which carries no name.
	 */
	static boolean broke(DataIntegrityViolationException exception, String constraintName) {
		return exception.getCause() instanceof ConstraintViolationException violation
				&& constraintName.equals(violation.getConstraintName());
	}
}
