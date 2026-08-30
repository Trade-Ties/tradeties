package com.tradeties.business;

import java.util.UUID;

/**
 * A trade a customer's description might mean, and how strongly.
 *
 * <p>A list rather than an answer, on purpose. Some descriptions name a trade beyond doubt — "no
 * hot water" reaches one and nothing else — and some genuinely do not: a kitchen cabinet is
 * carpentry and painting and, if it is leaking underneath, plumbing. Returning the best guess
 * alone would hide that from the one place equipped to resolve it, which is the customer.
 *
 * @param score how well the description fits, comparable only within one result list. It is a
 *              relevance ranking and not a probability — two entries close together mean the
 *              description did not separate them, which is the case worth asking about
 */
public record TradeMatch(UUID id, String code, String displayName, double score) {
}
