package com.tradeties.job.internal;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import com.tradeties.business.BookableService;
import com.tradeties.business.BookableServices;
import com.tradeties.business.GeoPoint;
import com.tradeties.business.OpenSlots;
import com.tradeties.business.Openings;
import com.tradeties.business.SiteLocations;
import com.tradeties.job.NewJob;
import com.tradeties.job.NoSuchBusinessException;
import com.tradeties.job.PlacedJob;
import com.tradeties.job.ServiceNotOfferedException;
import com.tradeties.job.SlotNotOfferedException;
import com.tradeties.mail.MailOutbox;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes a customer's job and the first request on it.
 *
 * <p><strong>Nothing a client sent decides what the request is worth.</strong> The duration, the
 * prices and the cancellation terms are read from the profile here and copied onto the row; the
 * body supplies only who, where, what and when.
 */
@Service
public class JobService {

	/**
	 * Enough starts to cover any single day. A quarter-hour grid running around the clock is
	 * ninety-six, so this cannot be the thing that ends the walk — which matters, because a capped
	 * answer would turn a legitimate start into "no longer offered".
	 */
	private static final int STARTS_IN_A_DAY = 200;

	private final BookableServices bookable;
	private final SiteLocations locations;
	private final OpenSlots openSlots;
	private final JobRepository jobs;
	private final JobRequestRepository requests;
	private final RequestHistory history;
	private final MailOutbox mail;
	private final String publicUrl;

	JobService(BookableServices bookable,
			SiteLocations locations,
			OpenSlots openSlots,
			JobRepository jobs,
			JobRequestRepository requests,
			RequestHistory history,
			MailOutbox mail,
			@Value("${tradeties.public-url}") String publicUrl) {

		this.bookable = bookable;
		this.locations = locations;
		this.openSlots = openSlots;
		this.jobs = jobs;
		this.requests = requests;
		this.history = history;
		this.mail = mail;
		this.publicUrl = publicUrl.replaceAll("/+$", "");
	}

	/**
	 * @throws NoSuchBusinessException no published business holds that slug
	 * @throws ServiceNotOfferedException it does, but not that service
	 * @throws SlotNotOfferedException that start is not one it is offering for that service
	 */
	@Transactional
	public PlacedJob place(NewJob submitted) {
		BookableService offered = bookable.find(submitted.slug(), submitted.serviceId())
				.orElseThrow(() -> unavailable(submitted));

		requireOffered(offered, submitted.startsAt());

		GeoPoint located = locations.locate(submitted.address()).orElse(null);

		String token = AccessTokens.issue();
		JobRow job = jobs.save(new JobRow(submitted, offered.tradeId(), offered.timeZone(), located,
				AccessTokens.digest(token), Instant.now().plus(AccessTokens.LIFETIME)));

		JobRequestRow request = requests.save(new JobRequestRow(job.id(), submitted.startsAt(), offered));
		history.record(request, null, Actor.CUSTOMER, null);

		PlacedJob placed = new PlacedJob(
				job.id(),
				token,
				job.accessTokenExpiresAt(),
				request.id(),
				offered.businessSlug(),
				offered.businessName(),
				offered.timeZone(),
				request.serviceName(),
				request.estimatedDurationMinutes(),
				request.startsAt(),
				request.endsAt(),
				request.currency(),
				request.cancellationFee(),
				request.cancellationNoticeHours());

		// Here, inside the transaction and while the clear token is still in hand — the one place
		// it ever is. The confirmation commits with the request or not at all, and it is sent
		// afterwards by the mail module, so a mail server being down cannot fail a booking.
		mail.enqueue(RequestConfirmation.compose(submitted, placed, publicUrl));

		return placed;
	}

	/**
	 * The start has to be one this business is offering right now, and it is checked against the
	 * very walk that offered it — same grid, same working week, same notice, same horizon, less
	 * declared time off and less appointments already accepted.
	 *
	 * <p><strong>Pending requests are not subtracted, and that is the rule rather than an
	 * omission.</strong> Two customers holding a pending request on one start is correct: a
	 * pending request must not let one of them freeze the other's calendar. It is the acceptance
	 * that takes the start off the list, and from then on this check refuses it — so contention is
	 * settled once, at acceptance, and the exclusion constraint is the net under that rather than
	 * the gate in front of it.
	 *
	 * <p>Asked for the one day the start falls on, read in the business's zone. A wider window
	 * would answer the same question at more cost.
	 */
	private void requireOffered(BookableService offered, Instant startsAt) {
		ZoneId zone = ZoneId.of(offered.timeZone());
		LocalDate day = LocalDate.ofInstant(startsAt, zone);

		Openings open = openSlots.within(offered.businessId(), zone, day, day,
				offered.estimatedDurationMinutes(), STARTS_IN_A_DAY);

		if (!open.starts().contains(startsAt)) {
			throw new SlotNotOfferedException(
					"That start is not on offer for this service. Read the calendar again.");
		}
	}

	/**
	 * Which of the two refusals it is, answered with a second read rather than guessed.
	 *
	 * <p>One lookup returning empty cannot say whether the business is missing or only the
	 * service, and the two send somebody to different places — a wrong address to the search, a
	 * retired service back to the profile. The extra query is paid only on the failing path.
	 */
	private RuntimeException unavailable(NewJob submitted) {
		if (!bookable.isPublished(submitted.slug())) {
			return new NoSuchBusinessException("No business is published at " + submitted.slug());
		}

		return new ServiceNotOfferedException(
				"This business does not offer the service " + submitted.serviceId());
	}
}
