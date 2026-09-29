package com.tradeties.job.internal;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;

import com.tradeties.mail.OutgoingMail;

/**
 * The two emails a conversation sends: a business's reply to the customer, and a customer's
 * message announced to the business.
 *
 * <p>The customer's carries a fresh link, because the one from their confirmation cannot be
 * written again. The business's carries a link to its inbox and nothing secret — it signs in.
 *
 * <p>Neither invites a reply to the email itself yet: nothing receives one. Both say where to
 * answer instead, which is the page for the customer and the inbox for the business.
 */
final class ConversationMail {

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US);

	private ConversationMail() {
	}

	static OutgoingMail toCustomer(String customerEmail, String customerName, String businessName, String body,
			String link, Instant linkExpiresAt, String timeZone) {

		String text = """
				Hi %s,

				%s replied to your request:

				%s

				To answer, or to see your request, open:
				%s

				Replies to this email don't reach them yet, so please answer on that page. The link works until %s — keep it to yourself.

				— TradeTies
				""".formatted(
				firstName(customerName),
				businessName,
				quote(body),
				link,
				DATE.format(linkExpiresAt.atZone(ZoneId.of(timeZone))));

		return new OutgoingMail(customerEmail, "%s replied to your request".formatted(businessName), text);
	}

	static OutgoingMail toBusiness(String businessEmail, String customerName, String serviceName, String body,
			String publicUrl, UUID requestId) {

		String text = """
				%s wrote about their request for %s:

				%s

				Answer in your inbox:
				%s/dashboard/inbox?c=%s

				— TradeTies
				""".formatted(customerName, serviceName, quote(body), publicUrl, requestId);

		return new OutgoingMail(businessEmail, "New message from %s".formatted(customerName), text);
	}

	/** The message set off from the email around it, every line of it. */
	private static String quote(String body) {
		return "  " + body.strip().replace("\n", "\n  ");
	}

	private static String firstName(String name) {
		String trimmed = name.strip();
		int space = trimmed.indexOf(' ');
		return space < 0 ? trimmed : trimmed.substring(0, space);
	}
}
