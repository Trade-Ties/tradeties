package com.tradeties.mail.internal;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The timer, kept apart from the sending so it alone can be switched off.
 *
 * <p>Off in tests, where a pass on its own clock would send mail in the middle of a test that is
 * counting rows. See src/test/resources/application.properties.
 *
 * <p>{@code fixedDelay}, as the geocode refiner uses: counted from the end of the last pass, so a
 * slow mail server cannot have two passes running on top of each other.
 */
@Component
@ConditionalOnProperty(name = "tradeties.mail.sender.enabled", havingValue = "true", matchIfMissing = true)
class OutboxSchedule {

	private final OutboxSender sender;

	OutboxSchedule(OutboxSender sender) {
		this.sender = sender;
	}

	@Scheduled(fixedDelayString = "${tradeties.mail.sender.interval}",
			initialDelayString = "${tradeties.mail.sender.initial-delay}")
	void sendDue() {
		sender.sendDue();
	}
}
