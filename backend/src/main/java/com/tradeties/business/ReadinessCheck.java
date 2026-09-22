package com.tradeties.business;

/**
 * @param detail what to do about it, phrased for the tradesperson. Present whether the check
 *               passed or not, so the client can render one list rather than two
 */
public record ReadinessCheck(ReadinessCheckCode code, boolean passed, boolean blocking, String detail) {

	/** A condition: failing it is what {@code ready} means, and publishing is refused. */
	public static ReadinessCheck passed(ReadinessCheckCode code, String detail) {
		return new ReadinessCheck(code, true, true, detail);
	}

	public static ReadinessCheck failed(ReadinessCheckCode code, String detail) {
		return new ReadinessCheck(code, false, true, detail);
	}

	/**
	 * Advice: shown on the same checklist and counted in nothing.
	 *
	 * <p>Two factories rather than a boolean argument, so that a check's nature is stated where
	 * it is built and cannot be flipped by a parameter somebody misreads at the call site. The
	 * difference matters: one of these holds a profile off the market and the other does not.
	 */
	public static ReadinessCheck advice(ReadinessCheckCode code, boolean met, String detail) {
		return new ReadinessCheck(code, met, false, detail);
	}
}
