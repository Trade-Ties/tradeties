package com.tradeties.job;

/**
 * Where one request stands, in the module's own words.
 *
 * <p>All six, because the table's check constraint names all six and a Java enum knowing fewer
 * would turn reading a row written by a later version into a crash rather than a value. Three are
 * reachable today: a request arrives {@code PENDING} and the business accepts or declines it.
 */
public enum RequestState {
	PENDING,
	ACCEPTED,
	DECLINED,
	WITHDRAWN,
	CANCELLED,
	COMPLETED
}
