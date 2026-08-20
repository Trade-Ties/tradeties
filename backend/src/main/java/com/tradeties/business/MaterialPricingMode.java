package com.tradeties.business;

/**
 * Material is not an amount, it is a model. What can be fixed up front is not what
 * material costs but how it is charged — a plain "material cost" field would be either
 * always empty or always wrong.
 */
public enum MaterialPricingMode {

	INCLUDED,

	AT_COST,

	/** Passed on with a markup, which then has to be stated. */
	COST_PLUS_MARKUP,

	NOT_PROVIDED
}
