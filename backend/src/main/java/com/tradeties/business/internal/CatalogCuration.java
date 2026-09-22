package com.tradeties.business.internal;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.tradeties.business.CatalogSuggestion;
import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.ServiceJob;
import com.tradeties.business.SuggestionSource;
import com.tradeties.business.SuggestionStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.http.HttpStatus;

/**
 * Deciding what the marketplace calls things.
 *
 * <p>The half of the catalogue that cannot be automated. {@link CatalogGaps} collects what people
 * ask for that no entry answers; this turns a collected phrase into an entry, or decides it was
 * never a job. Both are one person's judgement, and that is the design rather than a shortcoming:
 * the development seed is full of "Main line rooter service" and "Repipe assessment", which is
 * how tradespeople write and not how customers search. A rule that promoted phrases by their
 * count would fill the catalogue with exactly that.
 *
 * <p>What a promotion writes is not the phrase. "my chimney flue is cracked" is how somebody
 * described a problem; "Repair a cracked chimney flue" is the job. Making that translation is the
 * work, and it is the reason a person is in the loop at all.
 */
@Service
public class CatalogCuration {

	/** As long a code as the column holds, and the point at which a label is too long to be one. */
	private static final int CODE_LIMIT = 64;

	private final CatalogGapRepository gaps;
	private final ServiceCatalogRepository catalogue;
	private final CatalogTradeRepository trades;

	CatalogCuration(CatalogGapRepository gaps, ServiceCatalogRepository catalogue, CatalogTradeRepository trades) {
		this.gaps = gaps;
		this.catalogue = catalogue;
		this.trades = trades;
	}

	@Transactional(readOnly = true)
	public List<CatalogSuggestion> awaiting(SuggestionStatus status, int limit) {
		return gaps.withStatus(status.name(), limit).stream()
				.map(CatalogCuration::toSuggestion)
				.toList();
	}

	/**
	 * A collected phrase becomes a job the marketplace offers.
	 *
	 * <p>From the moment this returns, and with no deployment: customers are offered the job while
	 * they type, tradespeople can tick it in their own list, and the search can narrow to whoever
	 * offers it. That is what V18's {@code DO NOTHING} seed was for — the file plants what is
	 * missing and never overwrites, so a row written here survives every deploy after it.
	 *
	 * <p>One transaction for both writes. An entry with no suggestion pointing at it would lose
	 * where it came from; a suggestion marked promoted with no entry behind it would read as
	 * handled with nothing to show.
	 *
	 * @throws ResponseStatusException 409 when the phrase was already decided, or when the label
	 *         is one the catalogue already uses — which means the job has an entry and this phrase
	 *         belongs against that one
	 */
	@Transactional
	public ServiceJob promote(UUID suggestionId, String label, UUID tradeId, String synonyms) {
		String tidyLabel = label == null ? "" : label.strip();
		if (tidyLabel.isEmpty()) {
			throw new InvalidSelectionException("A promoted job needs a label customers would read");
		}

		CatalogTrade trade = trades.findById(tradeId)
				.filter(CatalogTrade::isActive)
				.orElseThrow(() -> new InvalidSelectionException("No such trade: " + tradeId));

		// The label first, because it is the one a person would notice: two entries reading the
		// same in a dropdown is what V18's rule is against, and their codes can differ by a word
		// order nobody sees.
		if (catalogue.hasLabel(tidyLabel)) {
			throw conflict("The catalogue already has a job called \"" + tidyLabel + "\"");
		}

		String code = codeFor(trade.toOption().code(), tidyLabel);
		if (catalogue.hasCode(code)) {
			throw conflict("The catalogue already has a job under " + code);
		}

		UUID entryId = UUID.randomUUID();
		catalogue.add(entryId, code, tradeId, tidyLabel, synonyms == null || synonyms.isBlank() ? null : synonyms.strip());

		decide(suggestionId, SuggestionStatus.PROMOTED, entryId);

		return new ServiceJob(entryId, code, tidyLabel, tradeId);
	}

	/**
	 * A phrase that was never a job: a typo, a duplicate, or a sentence describing nothing.
	 *
	 * <p>Marked rather than deleted. The row is the record that somebody already looked, which is
	 * what stops the same judgement being made a second time — and the counting goes on, so one
	 * that quietly climbs to four hundred can still be found and reconsidered.
	 */
	@Transactional
	public void dismiss(UUID suggestionId) {
		decide(suggestionId, SuggestionStatus.DISMISSED, null);
	}

	/**
	 * Records the decision, and refuses politely when there was already one.
	 *
	 * <p>The {@code status = 'NEW'} guard lives in the statement rather than in a check before it,
	 * so two people working the same list cannot both decide the same phrase. Zero rows updated
	 * then means somebody got there first — told apart from "no such phrase" by reading the row,
	 * because those deserve different answers.
	 */
	private void decide(UUID suggestionId, SuggestionStatus status, UUID entryId) {
		if (gaps.decide(suggestionId, status.name(), entryId) == 1) {
			return;
		}

		CatalogGapRepository.SuggestionRow existing = gaps.findById(suggestionId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such suggestion"));

		// Dismissing what is already dismissed asked for a state it is already in, which is not a
		// disagreement worth an error. Everything else is.
		if (status == SuggestionStatus.DISMISSED && SuggestionStatus.DISMISSED.name().equals(existing.getStatus())) {
			return;
		}

		throw conflict("This phrase was already " + existing.getStatus().toLowerCase(Locale.ROOT));
	}

	/**
	 * A stable identity assembled from the trade and the label.
	 *
	 * <p>Derived rather than asked for, so nobody has to invent one and nobody can mistype one.
	 * The same shape the seeded codes have — {@code PLUMBER_TOILET_REPLACE} — because they are the
	 * same kind of thing and a reader should not be able to tell which were seeded.
	 *
	 * <p>Truncated to the column's length at a word boundary where there is one. A code is an
	 * identity rather than a sentence, and half a word on the end reads like damage.
	 */
	private static String codeFor(String tradeCode, String label) {
		String slug = label.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
		String code = tradeCode + "_" + slug;

		if (code.length() <= CODE_LIMIT) {
			return code;
		}

		String cut = code.substring(0, CODE_LIMIT);
		int lastBreak = cut.lastIndexOf('_');

		return lastBreak > tradeCode.length() ? cut.substring(0, lastBreak) : cut;
	}

	private static ResponseStatusException conflict(String why) {
		return new ResponseStatusException(HttpStatus.CONFLICT, why);
	}

	private static CatalogSuggestion toSuggestion(CatalogGapRepository.SuggestionRow row) {
		return new CatalogSuggestion(row.getId(), SuggestionSource.valueOf(row.getSource()), row.getPhrase(),
				row.getSeenCount(), row.getFirstSeenAt(), row.getLastSeenAt(),
				SuggestionStatus.valueOf(row.getStatus()), row.getPromotedTo());
	}
}
