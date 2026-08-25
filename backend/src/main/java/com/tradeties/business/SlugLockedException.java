package com.tradeties.business;

/**
 * Not a race and not a uniqueness problem, unlike {@link SlugTakenException} — the requested slug
 * may well be free. It is refused because the profile has been published, so copies of the URL are
 * out in the world and none of them can be corrected from here.
 *
 * <p>Reported rather than quietly ignored. Keeping the stored slug and answering 200 would return
 * a profile that does not match what was sent, and the caller would have no way of noticing.
 *
 * <p>Carries the slug only. The sentence a tradesperson reads has to name the whole address, and
 * which host serves a published profile is a deployment's answer rather than a business rule's, so
 * it is applied where the ProblemDetail is assembled. See {@code BusinessExceptionHandler}.
 */
public class SlugLockedException extends RuntimeException {

	private final String storedSlug;

	public SlugLockedException(String storedSlug) {
		super("Profile URL is fixed by publication and cannot be changed from " + storedSlug);
		this.storedSlug = storedSlug;
	}

	public String storedSlug() {
		return storedSlug;
	}
}
