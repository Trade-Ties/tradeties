package com.tradeties.business;

import java.util.stream.Collectors;

/**
 * A write refused because it would leave a <em>published</em> profile failing the checklist:
 * findable in the marketplace, and impossible to book.
 *
 * <p>Not {@link ProfileNotReadyException}, which answers "you asked to publish and cannot yet"
 * and carries the checklist as its body. This one answers a request that was not about publishing
 * at all, so it says in prose what would have broken and the write is rolled back. Sharing the
 * one exception would put the same 422 on two endpoints meaning two different things.
 *
 * <p>Refusing rather than unpublishing: going dark is not what unticking a checkbox asked for,
 * and a profile taken off the market without being told is one whose owner finds out from the
 * silence.
 */
public class LiveProfileNotReadyException extends RuntimeException {

	public LiveProfileNotReadyException(ProfileReadiness readiness) {
		super("Your profile is live, so this change was not applied: " + wouldBreak(readiness)
				+ " Undo it here, or unpublish your profile first.");
	}

	private static String wouldBreak(ProfileReadiness readiness) {
		return readiness.checks().stream()
				.filter(check -> !check.passed())
				.map(ReadinessCheck::detail)
				.collect(Collectors.joining(" "));
	}
}
