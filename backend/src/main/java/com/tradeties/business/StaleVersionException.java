package com.tradeties.business;

/**
 * A write that named a version the server no longer holds — or named one where there is
 * nothing to replace, or named none where there is.
 *
 * <p>Its own type rather than Spring's {@code OptimisticLockingFailureException}, because this
 * module raises version conflicts about five different things — the profile, a service, a
 * licence, and rates in three ways — and one shared handler could not tell them apart.
 *
 * <p>A separate type also keeps Hibernate's own conflict distinguishable from ours. Its message
 * names the entity class and the row id, so it is the one that must <em>not</em> be passed on.
 */
public class StaleVersionException extends RuntimeException {

	/**
	 * @param detail what the client reads, word for word. It must name <strong>which</strong> thing
	 *        moved, and it must not carry the <strong>stored</strong> version — a client that
	 *        retries with a number it was handed overwrites exactly the change it was being warned
	 *        about. Echoing back the version the client itself sent is fine.
	 */
	public StaleVersionException(String detail) {
		super(detail);
	}
}
