package com.tradeties.business;

import java.util.List;

/**
 * One business as a customer sees it — the same company as {@link BusinessDetails}, and
 * deliberately not the same record.
 *
 * <p>What separates them is the whole of DECISIONS section 1's anonymity rule: no phone, no
 * email, no street address, no coordinates and no legal name. A town and a state are as close as
 * a stranger gets to where somebody works, which is what the search already answers with.
 *
 * <p><strong>The parts below are the owner's own records, reused rather than copied.</strong> A
 * service, a licence and a set of terms say the same thing to both sides, and a second set of
 * records would be two definitions of one service drifting apart. They carry a few fields the
 * customer has no use for — a version, a sort order, an active flag — and those are dropped where
 * the answer is written, not here: they are not secrets, and hiding a sort order behind a third
 * record would cost more than it saves.
 *
 * @param services what can be booked, still offered and in the business's own order. Never empty
 *                 for a published profile — {@code AT_LEAST_ONE_SERVICE} is what makes that true,
 *                 and its reason is that a service is what gives an appointment a length
 * @param pricing  never null for a published profile, for the same kind of reason:
 *                 {@code PRICING_SET} is a publishing condition because a request snapshots the
 *                 cancellation fee when it is sent
 * @param licenses only those that have not expired. A licence is a statement about today, and an
 *                 expired one is not a weaker version of it
 */
public record PublicProfile(
		String slug,
		String displayName,
		String description,
		String websiteUrl,
		String city,
		String state,
		String timeZone,
		TradeSelection trades,
		List<ServiceDetails> services,
		PricingTerms pricing,
		List<LicenseDetails> licenses) {

	public PublicProfile {
		services = services == null ? List.of() : List.copyOf(services);
		licenses = licenses == null ? List.of() : List.copyOf(licenses);
	}
}
