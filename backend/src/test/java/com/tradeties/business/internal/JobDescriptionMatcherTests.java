package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import com.tradeties.TestcontainersConfiguration;
import com.tradeties.business.TradeMatch;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Reading a trade out of a sentence, against the vocabulary actually seeded.
 *
 * <p>These are the phrasings a customer types, not the ones the seed file contains — matching a
 * seed phrase back to itself would prove only that the string is stored. What is worth asserting
 * is that a description nobody wrote down still lands on the right trade, which is what stemming
 * and any-word matching are for.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class JobDescriptionMatcherTests {

	@Autowired
	JobDescriptionMatcher matcher;

	@Test
	void aClearDescriptionNamesOneTrade() {
		assertEquals("PLUMBER", best("There is no hot water in the shower"));
		assertEquals("ELECTRICIAN", best("the breaker keeps tripping"));
		assertEquals("ROOFER", best("shingles came off in the storm"));
	}

	/**
	 * The stemming, which is the whole reason this is full text and not string comparison. The
	 * seed says "Leaking faucet"; nobody types that.
	 */
	@Test
	void wordEndingsDoNotHaveToMatch() {
		assertEquals("PLUMBER", best("my kitchen faucet has been leaking for a week"));
		assertEquals("LANDSCAPER", best("the hedges need trimming"));
	}

	/** A trade with no seeded phrasing is still findable by its own name. Six are in that state. */
	@Test
	void aTradeWithoutSeededWordsIsStillFoundByName() {
		assertEquals("HANDYPERSON", best("looking for a handyperson"));
	}

	/**
	 * The ambiguity that made this return a list. A cabinet belongs to carpentry and to painting,
	 * and a leak under it belongs to plumbing; the description does not separate them, so neither
	 * does this. Resolving it is the customer's to do, and they can only do it if they are shown
	 * that there was a choice.
	 */
	@Test
	void anAmbiguousDescriptionOffersMoreThanOne() {
		List<TradeMatch> matches = matcher.match("kitchen cabinet is damaged");

		assertTrue(matches.size() > 1, "one answer would hide the question, found: " + codes(matches));
	}

	/** Never more than a customer can be asked about, however many trades share a word. */
	@Test
	void theListStaysShortEnoughToOffer() {
		assertTrue(matcher.match("repair install damage water wall floor room").size() <= 3);
	}

	/**
	 * A search with no job description in it. Not an error and not everything — the caller reads
	 * an empty list as "the customer did not say what they need", and narrows by location alone.
	 */
	@Test
	void aDescriptionThatNamesNothingMatchesNothing() {
		assertTrue(matcher.match("the and of").isEmpty(), "stop words carry no trade");
		assertTrue(matcher.match("   ").isEmpty());
		assertTrue(matcher.match(null).isEmpty());
		assertTrue(matcher.match("qwertzuiop").isEmpty(), "a word in no vocabulary");
	}

	/** Ordered by fit, and stably: two calls must not disagree about a tie. */
	@Test
	void tiesComeBackInTheSameOrderEveryTime() {
		List<String> once = codes(matcher.match("kitchen cabinet is damaged"));

		assertEquals(once, codes(matcher.match("kitchen cabinet is damaged")));
		assertFalse(once.isEmpty(), "precondition");
	}

	private String best(String description) {
		List<TradeMatch> matches = matcher.match(description);
		assertFalse(matches.isEmpty(), "nothing matched: " + description);
		return matches.getFirst().code();
	}

	private static List<String> codes(List<TradeMatch> matches) {
		return matches.stream().map(TradeMatch::code).toList();
	}
}
