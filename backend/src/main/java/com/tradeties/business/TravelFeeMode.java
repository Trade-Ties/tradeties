package com.tradeties.business;

/**
 * The mode governs <em>both</em> travel amounts, not just its own. Switching from
 * {@link #FLAT} to {@link #PER_MILE} has to leave the old flat fee behind for good —
 * otherwise it sits there unused and resurfaces the next time somebody switches back. The
 * database refuses a row that keeps it.
 */
public enum TravelFeeMode {

	/** Neither amount may be set. */
	INCLUDED,

	FLAT,

	PER_MILE
}
