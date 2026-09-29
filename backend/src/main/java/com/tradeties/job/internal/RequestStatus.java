package com.tradeties.job.internal;

/**
 * The states a request moves through, as the table's own check constraint spells them.
 *
 * <p>All six, although {@code WITHDRAWN} and {@code COMPLETED} are not reachable yet. Declaring
 * them now is not speculation: the constraint already names them, the wire enum already returns
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
