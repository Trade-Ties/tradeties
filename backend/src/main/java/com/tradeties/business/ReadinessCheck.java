package com.tradeties.business;

/**
 * @param detail what to do about it, phrased for the tradesperson. Present whether the check
 *               passed or not, so the client can render one list rather than two
 */
public record ReadinessCheck(ReadinessCheckCode code, boolean passed, String detail) {

	public static ReadinessCheck passed(ReadinessCheckCode code, String detail) {
		return new ReadinessCheck(code, true, detail);
	}

	public static ReadinessCheck failed(ReadinessCheckCode code, String detail) {
		return new ReadinessCheck(code, false, detail);
	}
}
