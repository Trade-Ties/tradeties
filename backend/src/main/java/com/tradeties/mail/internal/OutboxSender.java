package com.tradeties.mail.internal;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sends what is waiting in the outbox, a batch at a time.
 *
 * <p>Always a bean, and never on a timer by itself — {@link OutboxSchedule} is what calls it, and
 * that one can be switched off. Tests drive this directly, the way the geocode refiner's are.
 *
 * <p><strong>At least once, not exactly once.</strong> The message is sent before the row is
 * marked, inside one transaction; a crash between the two sends it again on the next pass. A
 * duplicate confirmation is an annoyance. A lost one is a customer who never learns their request
 * arrived, and that is the failure this is built to rule out.
 */
@Component
class OutboxSender {

	private static final Logger log = LoggerFactory.getLogger(OutboxSender.class);

	/**
	 * Waits after the first, second, ... refusal. Short at first, because most refusals are a
	 * server restarting; long later, because a message still failing after an hour is failing for
	 * a reason more tries will not fix.
	 */
	private static final List<Duration> BACKOFF = List.of(
			Duration.ofMinutes(1),
			Duration.ofMinutes(5),
			Duration.ofMinutes(15),
			Duration.ofHours(1),
			Duration.ofHours(4));

	/** One more than the waits above: the last refusal has nothing left to wait for. */
	static final int MAX_ATTEMPTS = BACKOFF.size() + 1;

	private final OutboxRepository outbox;
	private final JavaMailSender mailSender;
	private final String from;
	private final int batchSize;

	OutboxSender(OutboxRepository outbox,
			JavaMailSender mailSender,
			@Value("${tradeties.mail.from}") String from,
			@Value("${tradeties.mail.sender.batch-size}") int batchSize) {

		this.outbox = outbox;
		this.mailSender = mailSender;
		this.from = from;
		this.batchSize = batchSize;
	}

	/**
	 * One pass: everything due, up to a batch.
	 *
	 * @return how many went, for the log and for the tests
	 */
	@Transactional
	public int sendDue() {
		Instant now = Instant.now();
		List<OutboxRow> due = outbox.lockDue(now, batchSize);

		int sent = 0;
		for (OutboxRow row : due) {
			try {
				mailSender.send(message(row));
				row.sent(now);
				sent++;
			}
			catch (MailException refused) {
				row.refused(refused.getMessage(), now, BACKOFF.get(Math.min(row.attempts(), BACKOFF.size() - 1)),
						MAX_ATTEMPTS);

				// The recipient stays out of the log: an address is personal data, and the row's
				// id is enough to find it for anybody entitled to look.
				if (row.status() == OutboxRow.Status.FAILED) {
					log.error("Mail {} failed for good after {} attempts: {}", row.id(), row.attempts(),
							refused.getMessage());
				}
				else {
					log.warn("Mail {} refused (attempt {}), retrying at {}: {}", row.id(), row.attempts(),
							row.nextAttemptAt(), refused.getMessage());
				}
			}
		}

		if (!due.isEmpty()) {
			log.info("Mail outbox: {} of {} sent", sent, due.size());
		}
		return sent;
	}

	private SimpleMailMessage message(OutboxRow row) {
		SimpleMailMessage message = new SimpleMailMessage();
		message.setFrom(from);
		message.setTo(row.recipient());
		message.setSubject(row.subject());
		message.setText(row.body());
		return message;
	}
}
