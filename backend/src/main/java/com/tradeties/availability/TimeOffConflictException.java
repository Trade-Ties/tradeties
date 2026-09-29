package com.tradeties.availability;

import java.util.List;

/**
 * Requests are in the way of a new entry and have not all been answered.
 *
 * <p>Carries every request in the way rather than only the unanswered ones: the dialog shows the
 * whole list again, and one that dropped the answered half would ask for them a second time.
 */
public class TimeOffConflictException extends RuntimeException {

	private final List<RequestInTheWay> inTheWay;

	public TimeOffConflictException(List<RequestInTheWay> inTheWay) {
		super(inTheWay.size() == 1
				? "One request falls in this time. Say what happens to it, then save again."
				: inTheWay.size() + " requests fall in this time. Say what happens to each, then save again.");
		this.inTheWay = List.copyOf(inTheWay);
	}

	public List<RequestInTheWay> inTheWay() {
		return inTheWay;
	}
}
