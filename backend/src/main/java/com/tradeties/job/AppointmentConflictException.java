package com.tradeties.job;

import java.util.List;

/**
 * Accepted appointments are in the way of a new time and have not all been moved or removed.
 * Carries all of them, answered or not, because the dialog shows the whole list again.
 */
public class AppointmentConflictException extends RuntimeException {

	private final List<AppointmentInTheWay> inTheWay;

	public AppointmentConflictException(List<AppointmentInTheWay> inTheWay) {
		super(inTheWay.size() == 1
				? "Another appointment holds part of this time. Move or remove it, then save again."
				: inTheWay.size() + " appointments hold part of this time. Move or remove each, then save again.");
		this.inTheWay = List.copyOf(inTheWay);
	}

	public List<AppointmentInTheWay> inTheWay() {
		return inTheWay;
	}
}
