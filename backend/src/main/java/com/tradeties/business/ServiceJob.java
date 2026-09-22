package com.tradeties.business;

import java.util.UUID;

/**
 * One job out of the marketplace catalogue.
 *
 * <p>Reference data, like a trade: the same for every caller, read once and handed to whatever
 * needs it. The picker behind onboarding step 4 is what it exists for — a business narrows this
 * list to the trades it holds and ticks what it does, which is the only way the service lists
 * ever get full enough for a search to narrow by job.
 *
 * @param id what a service sends back as its {@code catalogId}. The id rather than the code,
 *        because that is what the service carries and what the search joins on
 * @param code the job's stable human identity, for logs and for talking about it
 * @param label the job in the customer's words, and the name a service created from it takes.
 *        Deliberately not the trade's own wording — it is the same text a customer searches
 *        against, so "Unclog a sink, tub or shower drain" earns its place where "Main line
 *        rooter service" does not
 * @param tradeId the trade it is filed under. A business can only offer it while it holds that
 *        trade, which is a composite foreign key rather than a rule anybody has to remember
 */
public record ServiceJob(UUID id, String code, String label, UUID tradeId) {
}
