package com.tradeties.business.internal;

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Notes down what the catalogue could not name, so that filling it stops being guesswork.
 *
 * <p>Two sides write here without anybody deciding to: a tradesperson who typed a service the
 * catalogue does not list, and a customer whose description it could not match. Neither is an
 * error — the catalogue does not know every job, and what it does not know is how it learns.
 *
 * <p><strong>A note must never cost somebody their request.</strong> Every write runs in its own
 * transaction and every caller swallows what it throws. A customer's search failing because a
 * counter could not be incremented would be the wrong trade in both directions: the search is
 * what they came for, and the note is worth nothing on its own.
 *
 * <p><strong>Synchronous, and that is a size decision rather than a preference.</strong> It is one
 * upsert against a small table, on paths that already make several queries. Spring Modulith is on
 * the classpath and V1 created its outbox, so an event is the shape this takes the day the writing
 * is heavier or the listeners are more than one — but nothing in this application publishes an
 * event yet, and introducing the first one for a counter would be paying for a mechanism before
 * there is anything to spend it on.
 */
@Component
class CatalogGaps {

	private static final Logger log = LoggerFactory.getLogger(CatalogGaps.class);

	/** Who said it. Counted apart, because the two are different evidence about the same word. */
	enum Source {

		/** A tradesperson named work they do and the catalogue had no entry for it. */
		PRO,

		/** A customer described work they want and the catalogue could not name it. */
		CUSTOMER
	}

	private final CatalogGapRepository gaps;

	CatalogGaps(CatalogGapRepository gaps) {
		this.gaps = gaps;
	}

	/**
	 * One sighting of a phrase nothing in the catalogue answers, and nothing thrown either way.
	 *
	 * <p>The transaction is on the repository method, which is reached through a proxy and so
	 * actually gets one. A {@code @Transactional} neighbour in this class would not: a call from
	 * here would bypass the proxy and inherit whichever transaction the caller was already in —
	 * the search's read-only one, or a service creation this must never be able to roll back.
	 *
	 * <p>The try/catch is out here rather than inside for the same reason it has to be: a
	 * transaction can fail on commit, after the method body has returned, and a catch within it
	 * would not see that.
	 *
	 * <p>Blank and over-long input is dropped rather than stored. Neither teaches anybody
	 * anything, and the column is bounded — a phrase past its length would fail the insert, which
	 * is a logged failure on a path that should have nothing to log.
	 *
	 * @param phrase as typed. Whitespace is collapsed so that one phrase is one row, and nothing
	 *        else is normalised — how people write is what a reader of this table is trying to
	 *        learn, and lowercasing it here would throw exactly that away
	 */
	void note(Source source, String phrase) {
		String tidied = tidy(phrase);

		if (tidied.isEmpty() || tidied.length() > 300) {
			return;
		}

		try {
			gaps.sighted(source.name(), tidied, Instant.now());
		}
		catch (RuntimeException notImportantEnoughToFail) {
			log.warn("Could not note an unnamed {} phrase", source, notImportantEnoughToFail);
		}
	}

	private static String tidy(String phrase) {
		return phrase == null ? "" : phrase.strip().replaceAll("\\s+", " ");
	}
}
