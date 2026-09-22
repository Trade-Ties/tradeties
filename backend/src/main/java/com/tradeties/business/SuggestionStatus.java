package com.tradeties.business;

/**
 * What was decided about a collected phrase.
 *
 * <p>Decided rather than deleted, so the same judgement is not made twice — and so that a phrase
 * somebody dismissed which goes on being asked can still be found. Nothing here changes on its
 * own: a decision is not undone by traffic.
 */
public enum SuggestionStatus {

	/** Nobody has looked at it. This is the queue. */
	NEW,

	/** It became a catalogue entry, and the row records which. */
	PROMOTED,

	/** A typo, a duplicate, or a sentence describing no job at all. */
	DISMISSED
}
