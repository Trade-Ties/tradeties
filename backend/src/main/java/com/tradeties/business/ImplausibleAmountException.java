package com.tradeties.business;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

/**
 * An amount the column can hold and no business could mean — almost always a decimal point
 * two places too far right.
 *
 * <p>A 400 rather than a 409: nothing raced, the number was never a price. Its own type rather
 * than {@link InvalidSelectionException} because telling somebody their hourly rate was not on
 * the list would send them looking in the wrong place.
 *
 * <p>The ceilings themselves, and how they were chosen, live in {@code Amounts}.
 */
public class ImplausibleAmountException extends RuntimeException {

	/**
	 * @param subject how the amount is named to the reader, as a full noun phrase <em>with its
	 *                article</em> — {@code "An hourly rate"}, {@code "A travel rate per mile"}
	 * @param amount  what was sent, echoed exactly as it arrived rather than normalised, so that
	 *                comparing the message against the form finds the same characters in both
	 */
	public ImplausibleAmountException(String subject, BigDecimal amount, BigDecimal maximum) {
		super(message(subject, amount, maximum));
	}

	private static String message(String subject, BigDecimal amount, BigDecimal maximum) {
		StringBuilder message = new StringBuilder()
				.append(subject).append(" of ").append(amount.toPlainString())
				.append(" is beyond anything this marketplace accepts (at most ")
				.append(maximum.toPlainString()).append(").");

		shifted(amount, maximum).ifPresent(guess -> message
				.append(" Did you mean ").append(guess.toPlainString()).append('?'));

		return message.toString();
	}

	/**
	 * The mistake this catches is {@code 8900} for {@code 89.00}, so the guess is the same digits
	 * with the point put back. Offered only when the amount has no fractional part at all — nobody
	 * arrives at half a cent by slipping a decimal point — and only when the result would itself
	 * have been accepted.
	 */
	private static Optional<BigDecimal> shifted(BigDecimal amount, BigDecimal maximum) {
		if (amount.stripTrailingZeros().scale() > 0) {
			return Optional.empty();
		}

		// The amount had no fractional part, so moving the point produces at most two decimals and
		// setScale discards nothing but zeros.
		BigDecimal guess = amount.movePointLeft(2).setScale(2, RoundingMode.UNNECESSARY);

		return guess.compareTo(maximum) <= 0 ? Optional.of(guess) : Optional.empty();
	}
}
