package com.tradeties.job.internal;

/**
 * The states a request moves through, as the table's own check constraint spells them.
 *
 * <p>All six, although only {@code PENDING} is reachable until the inbox lands. Declaring the
 * rest now is not speculation: the constraint already names them, the wire enum already returns
 * them, and a Java enum that knew fewer would make reading a row written by a later version a
 * crash rather than a value.
 */
enum RequestStatus {
	PENDING,
	ACCEPTED,
	DECLINED,
	WITHDRAWN,
	CANCELLED,
	COMPLETED
}
