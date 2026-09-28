package com.tradeties.job;

/**
 * How the customer would rather be heard from about this job.
 *
 * <p>The module's own enum rather than the generated one, so the domain does not depend on the
 * shape of the wire. Absent is a third state and is carried as {@code null}: it means they did not
 * say, which is not either answer and must not be drawn as one.
 */
public enum ContactMethod {
	PHONE,
	EMAIL
}
