package com.tradeties.job;

/**
 * Where one request stands, in the module's own words.
 *
 * <p>All six, because the table's check constraint names all six and a Java enum knowing fewer
 * would turn reading a row written by a later version into a crash rather than a value.
 * {@code WITHDRAWN} and {@code COMPLETED} are not reachable yet.
 */
public enum RequestState {
	PENDING,
	ACCEPTED,
	DECLINED,
	WITHDRAWN,
	CANCELLED,
	COMPLETED
}
