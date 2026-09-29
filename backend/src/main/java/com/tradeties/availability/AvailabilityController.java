package com.tradeties.availability;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.tradeties.availability.internal.CalendarService;
import com.tradeties.availability.internal.TimeOffService;
import com.tradeties.generated.api.AvailabilityApi;
import com.tradeties.generated.model.BookingPolicy;
import com.tradeties.generated.model.BookingPolicyInput;
import com.tradeties.generated.model.TimeBlock;
import com.tradeties.generated.model.TimeOff;
import com.tradeties.generated.model.TimeOffInput;
import com.tradeties.generated.model.TimeOffResolution;
import com.tradeties.generated.model.TimeOffUpdate;
import com.tradeties.generated.model.WorkingDay;
import com.tradeties.generated.model.WorkingHours;
import com.tradeties.identity.CurrentMarketplaceUser;
import com.tradeties.identity.MarketplaceUser;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The calendar is addressed under {@code /api/v1/me/business/...} because that is where a
 * tradesperson looks for it, but this module owns and serves it. Moving the controller into
 * {@code business} to match the URL would reverse the module dependency.
 */
@RestController
class AvailabilityController implements AvailabilityApi {

	/**
	 * The contract's `LocalDateTime`: minutes, never seconds, and no offset. Strict, or a 31st of
	 * February would quietly become the 28th.
	 */
	private static final DateTimeFormatter WALL_CLOCK = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm")
			.withResolverStyle(ResolverStyle.STRICT);

	private final CurrentMarketplaceUser currentMarketplaceUser;
	private final CalendarService calendarService;
	private final TimeOffService timeOff;

	AvailabilityController(CurrentMarketplaceUser currentMarketplaceUser,
			CalendarService calendarService,
			TimeOffService timeOff) {

		this.currentMarketplaceUser = currentMarketplaceUser;
		this.calendarService = calendarService;
		this.timeOff = timeOff;
	}

	@Override
	public ResponseEntity<List<TimeOff>> listMyTimeOff() {
		List<TimeOffEntry> entries = timeOff.findUpcomingByOwner(currentUserId())
				.orElseThrow(AvailabilityController::noProfileYet);

		return ResponseEntity.ok(entries.stream().map(AvailabilityController::toWire).toList());
	}

	@Override
	public ResponseEntity<TimeOff> addMyTimeOff(TimeOffInput input) {
		TimeOffEntry stored = timeOff.addForOwner(requireTradesperson().id(),
						draft(input.getAllDay(), input.getFirstDay(), input.getLastDay(),
								input.getStartsAt(), input.getEndsAt(), input.getNote()),
						answers(input.getResolutions(), input.getDeclineReason()))
				.orElseThrow(AvailabilityController::noProfileYet);

		return ResponseEntity.status(HttpStatus.CREATED).body(toWire(stored));
	}

	@Override
	public ResponseEntity<TimeOff> replaceMyTimeOff(UUID timeOffId, TimeOffUpdate update) {
		TimeOffEntry stored = timeOff.replaceForOwner(requireTradesperson().id(), timeOffId, update.getVersion(),
						draft(update.getAllDay(), update.getFirstDay(), update.getLastDay(),
								update.getStartsAt(), update.getEndsAt(), update.getNote()),
						answers(update.getResolutions(), update.getDeclineReason()))
				.orElseThrow(AvailabilityController::noSuchTimeOff);

		return ResponseEntity.ok(toWire(stored));
	}

	@Override
	public ResponseEntity<Void> removeMyTimeOff(UUID timeOffId) {
		if (!timeOff.removeForOwner(requireTradesperson().id(), timeOffId)) {
			throw noSuchTimeOff();
		}

		return ResponseEntity.noContent().build();
	}

	@Override
	public ResponseEntity<WorkingHours> getMyWorkingHours() {

		return ResponseEntity.ok(toWire(calendarService.findWeekByOwner(currentUserId())
				.orElseThrow(AvailabilityController::noProfileYet)));
	}

	@Override
	public ResponseEntity<WorkingHours> setMyWorkingHours(WorkingHours workingHours) {

		WorkingWeek stored = calendarService
				.replaceWeekForOwner(requireTradesperson().id(), toDomain(workingHours))
				.orElseThrow(AvailabilityController::noProfileYet);

		return ResponseEntity.ok(toWire(stored));
	}

	@Override
	public ResponseEntity<BookingPolicy> getMyBookingPolicy() {

		return ResponseEntity.ok(toWire(calendarService.findRulesByOwner(currentUserId())
				.orElseThrow(AvailabilityController::noProfileYet)));
	}

	@Override
	public ResponseEntity<BookingPolicy> setMyBookingPolicy(BookingPolicyInput input) {

		BookingRules stored = calendarService
				.replaceRulesForOwner(requireTradesperson().id(), input.getVersion(), toDomain(input))
				.orElseThrow(AvailabilityController::noProfileYet);

		return ResponseEntity.ok(toWire(stored));
	}

	private UUID currentUserId() {
		return currentMarketplaceUser.resolve()
				.map(MarketplaceUser::id)
				.orElseThrow(AvailabilityController::noProfileYet);
	}

	private MarketplaceUser requireTradesperson() {
		return currentMarketplaceUser.requireTradesperson();
	}

	private static ResponseStatusException noProfileYet() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND,
				"No business profile for this account yet, so there is no calendar either");
	}

	private static ResponseStatusException noSuchTimeOff() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "No such time off in this calendar");
	}

	private static TimeOffDraft draft(Boolean allDay, LocalDate firstDay, LocalDate lastDay,
			String startsAt, String endsAt, String note) {

		return new TimeOffDraft(Boolean.TRUE.equals(allDay), firstDay, lastDay,
				wallClock(startsAt), wallClock(endsAt), note);
	}

	private static LocalDateTime wallClock(String value) {
		if (value == null) {
			return null;
		}

		try {
			return LocalDateTime.parse(value, WALL_CLOCK);
		} catch (DateTimeParseException notOnTheCalendar) {
			throw new InvalidTimeOffException(value + " is not a time on the calendar.");
		}
	}

	private static TimeOffAnswers answers(List<TimeOffResolution> resolutions, String declineReason) {
		Map<UUID, TimeOffAnswers.Resolution> byRequest = resolutions == null
				? Map.of()
				: resolutions.stream().collect(Collectors.toMap(
						TimeOffResolution::getRequestId,
						resolution -> TimeOffAnswers.Resolution.valueOf(resolution.getAction().getValue()),
						(first, second) -> second));

		return new TimeOffAnswers(byRequest, declineReason);
	}

	private static TimeOff toWire(TimeOffEntry entry) {
		TimeOff wire = new TimeOff()
				.id(entry.id())
				.allDay(entry.allDay())
				.timeZone(entry.timeZone())
				.note(entry.note())
				.version(entry.version());

		if (entry.allDay()) {
			wire.firstDay(entry.firstDay()).lastDay(entry.lastDay());
		} else {
			wire.startsAt(entry.startsAt().format(WALL_CLOCK)).endsAt(entry.endsAt().format(WALL_CLOCK));
		}

		return wire;
	}

	private static WorkingHours toWire(WorkingWeek week) {
		List<WorkingDay> days = week.byDay().entrySet().stream()
				.map(entry -> new WorkingDay()
						.dayOfWeek(entry.getKey().getValue())
						.blocks(entry.getValue().blocks().stream()
								.map(AvailabilityController::toWire)
								.toList()))
				.toList();

		return new WorkingHours().days(days);
	}

	private static TimeBlock toWire(HoursBlock block) {
		return new TimeBlock()
				.startsAt(format(block.startsAtMinutes()))
				.endsAt(format(block.endsAtMinutes()));
	}

	private static WorkingWeek toDomain(WorkingHours wire) {
		return new WorkingWeek(wire.getDays().stream()
				.map(day -> new OpenDay(
						DayOfWeek.of(day.getDayOfWeek()),
						day.getBlocks().stream().map(AvailabilityController::toDomain).toList()))
				.toList());
	}

	private static HoursBlock toDomain(TimeBlock wire) {
		return new HoursBlock(toMinutes(wire.getStartsAt()), toMinutes(wire.getEndsAt()));
	}

	/**
	 * Not {@link java.time.LocalTime#parse}: it refuses {@code 24:00}, the one value a day that
	 * runs to midnight has to send. Splitting on the colon is safe because the contract's pattern
	 * has already established two digits either side of exactly one colon.
	 */
	private static int toMinutes(String time) {
		return Integer.parseInt(time.substring(0, 2)) * 60 + Integer.parseInt(time.substring(3));
	}

	/**
	 * {@code %02d} is required rather than cosmetic: the client validates what it is sent against
	 * the contract's {@code HH:mm} pattern, which "9:00" fails. The same arithmetic renders 1440 as
	 * "24:00".
	 */
	private static String format(int minutes) {
		return "%02d:%02d".formatted(minutes / 60, minutes % 60);
	}

	private static BookingPolicy toWire(BookingRules rules) {
		return new BookingPolicy()
				.bookingHorizonDays(rules.bookingHorizonDays())
				.minLeadTimeHours(rules.minLeadTimeHours())
				.maxAcceptedAppointmentsPerDay(rules.maxAcceptedAppointmentsPerDay())
				.slotGranularityMinutes(
						BookingPolicy.SlotGranularityMinutesEnum.fromValue(rules.slotGranularityMinutes()))
				.appointmentBufferMinutes(rules.appointmentBufferMinutes())
				.version(rules.version());
	}

	private static BookingRules toDomain(BookingPolicyInput input) {
		return new BookingRules(
				input.getBookingHorizonDays(),
				input.getMinLeadTimeHours(),
				input.getMaxAcceptedAppointmentsPerDay(),
				input.getSlotGranularityMinutes().getValue(),
				input.getAppointmentBufferMinutes(),
				input.getVersion());
	}
}
