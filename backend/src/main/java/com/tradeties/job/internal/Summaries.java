package com.tradeties.job.internal;

import com.tradeties.business.BusinessNames.BusinessName;
import com.tradeties.job.ConversationMessage;
import com.tradeties.job.RequestSummary;

/** The two read models every side of a conversation builds from the same rows. */
final class Summaries {

	private Summaries() {
	}

	/**
	 * @param name the business as it is called now; null when it is gone, which a request
	 *        outliving its business is allowed to be
	 */
	static RequestSummary of(JobRequestRow request, JobRow job, BusinessName name) {
		return new RequestSummary(
				request.id(),
				request.status().name(),
				name == null ? "" : name.slug(),
				name == null ? "A business no longer on TradeTies" : name.displayName(),
				request.serviceName(),
				request.estimatedDurationMinutes(),
				request.startsAt(),
				request.endsAt(),
				job.timeZone(),
				request.currency(),
				request.cancellationFee(),
				request.cancellationNoticeHours());
	}

	static ConversationMessage of(JobMessageRow message) {
		return new ConversationMessage(message.id(), message.author().name(), message.body(), message.createdAt());
	}
}
