package com.tradeties.business;

import java.util.List;
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

	/**
	 * @param broken the conditions this change broke — not everything the profile fails. A live
	 *        profile can already be failing something the owner is on their way to fixing, and
	 *        naming that here would blame this change for it
	 */
	public LiveProfileNotReadyException(List<ReadinessCheck> broken) {
		super("Your profile is live, so this change was not applied: " + wouldBreak(broken)
				+ " Undo it here, or unpublish your profile first.");
	}

	private static String wouldBreak(List<ReadinessCheck> broken) {
		return broken.stream()
				.map(ReadinessCheck::detail)
				.collect(Collectors.joining(" "));
	}
}
