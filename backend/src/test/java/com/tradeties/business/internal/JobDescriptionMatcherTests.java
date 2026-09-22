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
	 * The ambiguity that made this return a list. A hole in a bathtub is a plumber's job or a
	 * refinisher's, and Painter carries the second; the sentence does not separate them, so
	 * neither does this. Resolving it is the customer's to do, and they can only do it if they
	 * are shown that there was a choice.
	 *
	 * <p>This asked "kitchen cabinet is damaged" until V20, and that example was wrong. Carpenter
	 * accounted for two of its words and Painter for one — it only looked ambiguous because the
	 * scoring of the day could not see the difference. A real tie is a tie in word count, and
	 * this one is: both trades reach exactly one word of it.
	 */
	@Test
	void anAmbiguousDescriptionOffersMoreThanOne() {
		List<TradeMatch> matches = matcher.match("there is a hole in the bathtub");

		assertTrue(matches.size() > 1, "one answer would hide the question, found: " + codes(matches));
	}

	/**
	 * The rule V20 replaced a score threshold with, and the report that prompted it: a customer
	 * typing "Toilet is leaking" was offered a roofer.
	 *
	 * <p>Roofer is not a wrong entry in the vocabulary — "roof leak" and "gutters leaking" both
	 * belong there — it simply accounts for one word of this sentence where Plumber accounts for
	 * both. Every trade returned widens the businesses the customer sees, so a trade that explains
	 * less of what they wrote is not an answer to keep.
	 */
	@Test
	void aTradeThatExplainsLessOfTheSentenceIsNotOffered() {
		assertEquals(List.of("PLUMBER"), codes(matcher.match("Toilet is leaking")));
		assertEquals(List.of("PLUMBER"), codes(matcher.match("my kitchen faucet has been leaking")));
		assertEquals(List.of("LANDSCAPER"), codes(matcher.match("the hedges need trimming")));
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
		List<String> once = codes(matcher.match("there is a hole in the bathtub"));

		assertEquals(once, codes(matcher.match("there is a hole in the bathtub")));
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
