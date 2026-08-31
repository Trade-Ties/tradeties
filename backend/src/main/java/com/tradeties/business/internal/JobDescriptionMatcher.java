package com.tradeties.business.internal;

import java.util.List;

import com.tradeties.business.TradeMatch;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads a trade out of the sentence a customer typed.
 *
 * <p>The customer is never asked to pick one — the landing page takes the problem and the postal
 * code, and nothing else. So "Kitchen sink is leaking under the cabinet" has to become Plumber
 * somewhere, and this is where.
 *
 * <p>Against the catalogue, not against the businesses. Which trades exist is a small, curated
 * set with vocabulary written for it; what any one business calls its own services is a second
 * source that could join this later and is not needed to answer the question.
 */
@Component
class JobDescriptionMatcher {

	/**
	 * Enough to show a customer as alternatives when the description is ambiguous, and few enough
	 * that the tail — a trade sharing one incidental word — never reaches them.
	 */
	private static final int MOST_WORTH_OFFERING = 3;

	private final CatalogTradeRepository trades;

	JobDescriptionMatcher(CatalogTradeRepository trades) {
		this.trades = trades;
	}

	/**
	 * @param description what the customer typed, in their words. Null, blank or nothing but stop
	 *        words is not an error — it is a search without a job in it, and the answer is that no
	 *        trade was named rather than that every trade was
	 * @return best first, at most {@value #MOST_WORTH_OFFERING}. Empty when the description names
	 *         no trade, which the caller reads as "do not narrow by trade" rather than as "show
	 *         nothing"
	 */
	@Transactional(readOnly = true)
	List<TradeMatch> match(String description) {
		if (description == null || description.isBlank()) {
			return List.of();
		}

		return trades.findMatching(description, MOST_WORTH_OFFERING).stream()
				.map(row -> new TradeMatch(row.getId(), row.getCode(), row.getDisplayName(), row.getScore()))
				.toList();
	}
}
