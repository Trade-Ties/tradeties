package com.tradeties.job.internal;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Currency;
import java.util.Locale;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.tradeties.business.PostalAddress;
import com.tradeties.job.NewJob;
import com.tradeties.job.PlacedJob;
import com.tradeties.mail.OutgoingMail;

/**
 * The email a customer gets for sending a request: what they asked for, when, and the way back.
 *
 * <p><strong>Composed while the request is being written, because only then can it be.</strong>
 * The link carries the access token in the clear, and the clear token exists in exactly one place
 * — {@link PlacedJob}, for the length of the call that created it. The database keeps a digest, so
 * nothing written later could put this link in an email. It is this message or no link at all.
 *
 * <p>Every time is read on the business's clock, the zone the slot was offered in, and says which
 * zone it is. A customer booking from another state reads the same "8:00 AM" the tradesperson
 * will turn up at, with the letters that tell them so.
 */
final class RequestConfirmation {

	private static final Locale US = Locale.US;
	private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEEE, MMMM d", US);
	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", US);
	private static final DateTimeFormatter ZONE = DateTimeFormatter.ofPattern("zzz", US);
	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MMMM d, yyyy", US);

	private RequestConfirmation() {
	}

	/**
	 * @param requestUrl where the customer's own page is, with the token not yet on it
	 */
	static OutgoingMail compose(NewJob submitted, PlacedJob placed, String requestUrl) {
		ZoneId zone = ZoneId.of(placed.timeZone());
		ZonedDateTime start = placed.startsAt().atZone(zone);
		ZonedDateTime end = placed.endsAt().atZone(zone);

		String when = "%s, %s – %s (%s)".formatted(
				DAY.format(start), TIME.format(start), TIME.format(end), ZONE.format(start));
		String link = requestUrl + "/" + placed.accessToken();
		String validUntil = DATE.format(placed.accessTokenExpiresAt().atZone(zone));

		String body = """
				Hi %s,

				Your request has been sent to %s.

				  %s
				  %s
				  %s

				What you told them:
				  %s
				%s
				%s hasn't confirmed yet, and the time isn't held until they do. You'll hear from them by email.

				See your request at any time:
				%s

				That link is your way back to this request, so you don't need an account. Keep it to yourself: anybody who has it can read the request. It works until %s.

				— TradeTies
				""".formatted(
				firstName(submitted.customerName()),
				placed.businessName(),
				placed.serviceName(),
				when,
				address(submitted.address()),
				indent(submitted.description()),
				cancellation(placed),
				placed.businessName(),
				link,
				validUntil);

		return new OutgoingMail(
				submitted.customerEmail(),
				"Your request to %s has been sent".formatted(placed.businessName()),
				body);
	}

	/** "Jane" out of "Jane Cooper"; the whole of it when there is nothing to split. */
	private static String firstName(String name) {
		String trimmed = name.strip();
		int space = trimmed.indexOf(' ');
		return space < 0 ? trimmed : trimmed.substring(0, space);
	}

	/** One line, the way it is read out: "1420 Pearl St, Apt 2, Denver, CO 80203". */
	private static String address(PostalAddress a) {
		return Stream.of(a.street1(), a.street2(), a.city(), a.state() + " " + a.postalCode())
				.filter(part -> part != null && !part.isBlank())
				.collect(Collectors.joining(", "));
	}

	/** The customer's own words, kept under their heading even when they ran to several lines. */
	private static String indent(String text) {
		return text.strip().replace("\n", "\n  ");
	}

	/**
	 * The fee they agreed to by sending, said now rather than discovered at the door. Nothing at
	 * all when there is none — "no cancellation fee" is not news worth a paragraph.
	 */
	private static String cancellation(PlacedJob placed) {
		BigDecimal fee = placed.cancellationFee();
		if (fee == null || fee.signum() == 0) {
			return "";
		}

		NumberFormat money = NumberFormat.getCurrencyInstance(US);
		money.setCurrency(Currency.getInstance(placed.currency()));

		return "\nCancelling less than %d hours before the start costs %s.\n".formatted(
				placed.cancellationNoticeHours(), money.format(fee));
	}
}
