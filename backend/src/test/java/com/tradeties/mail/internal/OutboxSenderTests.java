package com.tradeties.mail.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.UUID;

import com.tradeties.TestcontainersConfiguration;
import com.tradeties.mail.MailOutbox;
import com.tradeties.mail.OutgoingMail;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The outbox from enqueue to delivery, against real PostgreSQL and a stand-in for SMTP.
 *
 * <p><strong>Everything else in the outbox is moved out of the way first.</strong> The database is
 * shared with every other suite, and a pass sends whatever is due — so without this, a test here
 * would "send" another suite's confirmation and empty the body that suite is about to read.
 * Pushing their rows a day ahead leaves them exactly as they were, and leaves this test's row the
 * only one due.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class OutboxSenderTests {

	@MockitoBean
	JavaMailSender mailSender;

	@Autowired
	OutboxSender sender;

	@Autowired
	MailOutbox outbox;

	@Autowired
	TransactionTemplate transaction;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void onlyThisTestsMailIsDue() {
		jdbc.update("UPDATE mail_outbox SET next_attempt_at = now() + interval '1 day' WHERE status = 'PENDING'");
	}

	@Test
	void sendsWhatIsDueAndForgetsTheBody() {
		String to = enqueue("Your link: https://example.test/request/secret-token");

		sender.sendDue();

		ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class);
		verify(mailSender).send(sent.capture());
		assertThat(sent.getValue().getTo()).containsExactly(to);
		assertThat(sent.getValue().getSubject()).isEqualTo("Subject for " + to);
		assertThat(sent.getValue().getText()).contains("secret-token");
		assertThat(sent.getValue().getFrom()).isNotBlank();

		// Sent, stamped, and the link with the credential in it gone from the database.
		assertThat(row(to, "status")).isEqualTo("SENT");
		assertThat(row(to, "sent_at")).isNotNull();
		assertThat(row(to, "body")).isNull();
	}

	/** A refusal is not a failure: the message waits and goes on a later pass, text intact. */
	@Test
	void retriesARefusalLater() {
		String to = enqueue("Retry me");
		doThrow(new MailSendException("451 try again later")).when(mailSender).send(any(SimpleMailMessage.class));

		sender.sendDue();

		assertThat(row(to, "status")).isEqualTo("PENDING");
		assertThat(row(to, "attempts")).isEqualTo(1);
		assertThat(row(to, "last_error")).asString().contains("451");
		assertThat((java.sql.Timestamp) row(to, "next_attempt_at")).isAfter(java.sql.Timestamp.from(Instant.now()));
		assertThat(row(to, "body")).isEqualTo("Retry me");
	}

	/**
	 * After the last attempt it stops, and keeps the body — a message that never arrived is
	 * exactly the one somebody will need to read.
	 */
	@Test
	void givesUpAfterTheLastAttempt() {
		String to = enqueue("Never arrives");
		doThrow(new MailSendException("550 no such user")).when(mailSender).send(any(SimpleMailMessage.class));

		for (int attempt = 0; attempt < OutboxSender.MAX_ATTEMPTS; attempt++) {
			// Due again at once, rather than waiting out hours of backoff.
			jdbc.update("UPDATE mail_outbox SET next_attempt_at = now() WHERE recipient = ?", to);
			sender.sendDue();
		}

		assertThat(row(to, "status")).isEqualTo("FAILED");
		assertThat(row(to, "attempts")).isEqualTo(OutboxSender.MAX_ATTEMPTS);
		assertThat(row(to, "body")).isEqualTo("Never arrives");
	}

	/**
	 * Without a transaction to join it refuses, rather than committing the email on its own for
	 * something that may yet roll back.
	 */
	@Test
	void refusesToWriteOutsideTheCallersTransaction() {
		assertThatThrownBy(() -> outbox.enqueue(new OutgoingMail("nobody@example.test", "s", "b")))
				.isInstanceOf(IllegalTransactionStateException.class);
	}

	/** A recipient no other test uses, so the row can be found by it. */
	private String enqueue(String body) {
		String to = "outbox-" + UUID.randomUUID() + "@example.test";
		transaction.executeWithoutResult(status -> outbox.enqueue(new OutgoingMail(to, "Subject for " + to, body)));
		return to;
	}

	private Object row(String recipient, String column) {
		return jdbc.queryForObject("SELECT " + column + " FROM mail_outbox WHERE recipient = ?", Object.class,
				recipient);
	}
}
