package com.tradeties.job;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import com.tradeties.business.PostalAddress;
import com.tradeties.generated.model.Address;
import com.tradeties.generated.model.JobRequestStatus;
import com.tradeties.generated.model.JobRequestSummary;
import com.tradeties.generated.model.Message;
import com.tradeties.generated.model.MessageAuthor;

/** The job module's read models in the contract's shapes, shared by both of its controllers. */
final class Wire {

	private Wire() {
	}

	static JobRequestSummary summary(RequestSummary request) {
		return new JobRequestSummary()
				.id(request.id())
				.status(JobRequestStatus.fromValue(request.status()))
				.businessSlug(request.businessSlug())
				.businessName(request.businessName())
				.serviceName(request.serviceName())
				.estimatedDurationMinutes(request.estimatedDurationMinutes())
				.startsAt(utc(request.startsAt()))
				.endsAt(utc(request.endsAt()))
				.timeZone(request.timeZone())
				.currency(request.currency())
				.cancellationFee(request.cancellationFee().toPlainString())
				.cancellationNoticeHours(request.cancellationNoticeHours());
	}

	static Message message(ConversationMessage message) {
		return new Message()
				.id(message.id())
				.author(MessageAuthor.fromValue(message.author()))
				.body(message.body())
				.sentAt(utc(message.sentAt()));
	}

	static Address address(PostalAddress address) {
		return new Address()
				.street1(address.street1())
				.street2(address.street2())
				.city(address.city())
				.state(address.state())
				.postalCode(address.postalCode());
	}

	/**
	 * Instants go out at UTC rather than at the business's offset. The zone the reader needs is a
	 * field of its own, and an offset baked into the timestamp is the second copy of it that can
	 * disagree — over a daylight saving switch it would.
	 */
	static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}
}
