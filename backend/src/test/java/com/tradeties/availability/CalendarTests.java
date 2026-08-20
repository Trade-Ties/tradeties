package com.tradeties.availability;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Onboarding steps 7 and 8, against the real exclusion constraint.
 *
 * <p>The week is the interesting half: blocks are checked against each other, and the
 * boundary between "adjacent" and "overlapping" is what makes a lunch break expressible as
 * two blocks instead of a special case.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CalendarTests {

	private static final String NINE_TO_FIVE = """
			[{"startsAt":"09:00","endsAt":"17:00"}]""";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/** Seven days, all closed — a different statement from "not configured". */
	@Test
	void aFreshBusinessHasAClosedWeek() throws Exception {
		RequestPostProcessor token = businessFor("user_closed_week", "closed-week");

		mockMvc.perform(get("/api/v1/me/business/working-hours").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days.length()").value(7))
				.andExpect(jsonPath("$.days[0].dayOfWeek").value(1))
				.andExpect(jsonPath("$.days[0].blocks.length()").value(0));
	}

	/** A lunch break is two blocks, not a field. */
	@Test
	void twoBlocksOnOneDayAreStored() throws Exception {
		RequestPostProcessor token = businessFor("user_lunch", "lunch");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"08:00","endsAt":"12:00"},{"startsAt":"13:00","endsAt":"18:00"}]"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[0].blocks.length()").value(2))
				.andExpect(jsonPath("$.days[0].blocks[0].startsAt").value("08:00"))
				.andExpect(jsonPath("$.days[0].blocks[1].endsAt").value("18:00"));
	}

	/**
	 * The boundary the whole model hangs on: {@code [start, end)} means 12:00 belongs to the
	 * second block, not to both. Were it inclusive, no business could describe a continuous
	 * day in two halves.
	 */
	@Test
	void blocksThatTouchAreAdjacentNotOverlapping() throws Exception {
		RequestPostProcessor token = businessFor("user_touching", "touching");

		mockMvc.perform(setWeek(token, "[]", """
				[{"startsAt":"08:00","endsAt":"12:00"},{"startsAt":"12:00","endsAt":"18:00"}]"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[1].blocks.length()").value(2));
	}

	@Test
	void overlappingBlocksAreRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_overlap", "overlap");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"08:00","endsAt":"12:00"},{"startsAt":"11:00","endsAt":"15:00"}]"""))
				.andExpect(status().isBadRequest());
	}

	/** A night shift is two blocks on two days, which is why a block may not wrap midnight. */
	@Test
	void aBlockMustEndAfterItStarts() throws Exception {
		RequestPostProcessor token = businessFor("user_backwards", "backwards");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"22:00","endsAt":"02:00"}]"""))
				.andExpect(status().isBadRequest());
	}

	/**
	 * A block is stored as minutes since midnight precisely so that its end can be 1440.
	 * With {@code LocalTime} and a {@code TIME} column the best a business could say was
	 * "until 23:59", and the minute before midnight quietly stopped being bookable.
	 */
	@Test
	void aDayMayRunUntilMidnight() throws Exception {
		RequestPostProcessor token = businessFor("user_until_midnight", "until-midnight");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"18:00","endsAt":"24:00"}]"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[0].blocks[0].endsAt").value("24:00"));
	}

	@Test
	void aFullDayIsOneBlock() throws Exception {
		RequestPostProcessor token = businessFor("user_all_day", "all-day");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"00:00","endsAt":"24:00"}]"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[0].blocks[0].startsAt").value("00:00"))
				.andExpect(jsonPath("$.days[0].blocks[0].endsAt").value("24:00"));
	}

	/**
	 * Two rows on two weekdays is still the model — but the seam between them has to close.
	 * "22:00 to 23:59, then 00:00" left one minute out of the calendar every night, which is
	 * not what "two blocks on two days" was ever supposed to mean.
	 */
	@Test
	void aNightShiftMeetsAtMidnightWithoutAGap() throws Exception {
		RequestPostProcessor token = businessFor("user_night_shift", "night-shift");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"22:00","endsAt":"24:00"}]""", """
				[{"startsAt":"00:00","endsAt":"02:00"}]"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[0].blocks[0].endsAt").value("24:00"))
				.andExpect(jsonPath("$.days[1].blocks[0].startsAt").value("00:00"));
	}

	/**
	 * The one thing the shared {@code TimeOfDay} schema cannot say.
	 *
	 * <p>{@code 24:00} is a legal time of day and therefore a syntactically legal start, but
	 * no block can begin there — nothing is above it to end at. Splitting the contract into a
	 * start type and an end type would say so in the schema and buy nothing, so the ordering
	 * rule catches it and this test is what says the gap is covered.
	 */
	@Test
	void midnightIsNotAStart() throws Exception {
		RequestPostProcessor token = businessFor("user_starts_at_end", "starts-at-end");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"24:00","endsAt":"24:00"}]"""))
				.andExpect(status().isBadRequest());
	}

	@Test
	void theSameHoursOnAnotherDayAreFine() throws Exception {
		RequestPostProcessor token = businessFor("user_same_hours", "same-hours");

		mockMvc.perform(setWeek(token, NINE_TO_FIVE, NINE_TO_FIVE))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[0].blocks.length()").value(1))
				.andExpect(jsonPath("$.days[1].blocks.length()").value(1));
	}

	/**
	 * Replacing has to delete before it inserts. Without a flush between the two halves,
	 * Hibernate may order the inserts first and the exclusion constraint then sees the old
	 * and the new blocks at once — rejecting a week that is perfectly valid.
	 */
	@Test
	void replacingAWeekWithOverlappingHoursSucceeds() throws Exception {
		RequestPostProcessor token = businessFor("user_replaces_week", "replaces-week");

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"08:00","endsAt":"12:00"}]"""))
				.andExpect(status().isOk());

		mockMvc.perform(setWeek(token, """
				[{"startsAt":"09:00","endsAt":"13:00"}]"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[0].blocks[0].startsAt").value("09:00"));
	}

	/** Whole hours must still come back as HH:mm — "9:00" would fail the client's own pattern. */
	@Test
	void wholeHoursKeepTheirMinutes() throws Exception {
		RequestPostProcessor token = businessFor("user_whole_hours", "whole-hours");

		mockMvc.perform(setWeek(token, "[]", "[]", NINE_TO_FIVE))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[2].blocks[0].startsAt").value("09:00"));
	}

	/** All seven days or nothing: omitting one would turn "closed" into a shrug. */
	@Test
	void aPartialWeekIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_partial_week", "partial-week");

		mockMvc.perform(put("/api/v1/me/business/working-hours").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"days":[{"dayOfWeek":1,"blocks":[]}]}"""))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The count is right, so the contract's {@code minItems}/{@code maxItems} of 7 is
	 * satisfied — and no schema rule can catch the rest, because {@code uniqueItems} compares
	 * whole objects and two different Mondays are two distinct items.
	 *
	 * <p>The mistake is a plausible one and not an attack: a lunch break modelled as two entries
	 * for the day rather than as two blocks within it. {@link #twoBlocksOnOneDayAreStored} is
	 * the shape that is meant, and the message says so. Answering 200 and keeping whichever
	 * Monday came first would leave the business closed after lunch without telling anyone.
	 */
	@Test
	void aWeekThatNamesADayTwiceIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_day_twice", "day-twice");

		StringBuilder days = new StringBuilder()
				.append("{\"dayOfWeek\":1,\"blocks\":[{\"startsAt\":\"08:00\",\"endsAt\":\"12:00\"}]},")
				.append("{\"dayOfWeek\":1,\"blocks\":[{\"startsAt\":\"13:00\",\"endsAt\":\"17:00\"}]}");

		for (int day = 2; day <= 6; day++) {
			days.append(",{\"dayOfWeek\":").append(day).append(",\"blocks\":[]}");
		}

		mockMvc.perform(put("/api/v1/me/business/working-hours").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"days\":[" + days + "]}"))
				.andExpect(status().isBadRequest());

		// Refused before anything is written, so Monday is still closed rather than half-set.
		mockMvc.perform(get("/api/v1/me/business/working-hours").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.days[0].blocks.length()").value(0));
	}

	/** Never a 404 for an existing business: the defaults are a real answer. */
	@Test
	void theRulesAnswerWithDefaultsBeforeStepEight() throws Exception {
		RequestPostProcessor token = businessFor("user_default_rules", "default-rules");

		mockMvc.perform(get("/api/v1/me/business/booking-policy").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bookingHorizonDays").value(60))
				.andExpect(jsonPath("$.minLeadTimeHours").value(24))
				.andExpect(jsonPath("$.slotGranularityMinutes").value(30))
				.andExpect(jsonPath("$.appointmentBufferMinutes").value(0))
				.andExpect(jsonPath("$.maxAcceptedAppointmentsPerDay").doesNotExist())
				.andExpect(jsonPath("$.version").value(0));
	}

	@Test
	void theRulesCanBeSetAndComeBack() throws Exception {
		RequestPostProcessor token = businessFor("user_sets_rules", "sets-rules");

		mockMvc.perform(setRules(token, 0, """
				"bookingHorizonDays":30,"minLeadTimeHours":4,"maxAcceptedAppointmentsPerDay":3,
				"slotGranularityMinutes":15,"appointmentBufferMinutes":30"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bookingHorizonDays").value(30))
				.andExpect(jsonPath("$.maxAcceptedAppointmentsPerDay").value(3))
				.andExpect(jsonPath("$.version").value(1));

		mockMvc.perform(get("/api/v1/me/business/booking-policy").with(token))
				.andExpect(jsonPath("$.appointmentBufferMinutes").value(30));
	}

	@Test
	void aStaleVersionIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_stale_rules", "stale-rules");

		mockMvc.perform(setRules(token, 99, """
				"bookingHorizonDays":30,"minLeadTimeHours":4,
				"slotGranularityMinutes":15,"appointmentBufferMinutes":0"""))
				.andExpect(status().isConflict());
	}

	/** 15, 30 or 60 — the grid the database also constrains. */
	@Test
	void anImpossibleSlotGridIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_bad_grid", "bad-grid");

		mockMvc.perform(setRules(token, 0, """
				"bookingHorizonDays":30,"minLeadTimeHours":4,
				"slotGranularityMinutes":7,"appointmentBufferMinutes":0"""))
				.andExpect(status().isBadRequest());
	}

	/**
	 * Setting the working week must provision the policy row, because that row is what every
	 * calendar write locks on. Without it, {@code SELECT … FOR UPDATE} would return nothing,
	 * lock nothing, and report no error — the failure mode that leaves no trace.
	 */
	@Test
	void writingTheWeekProvisionsTheRowTheLockNeeds() throws Exception {
		RequestPostProcessor token = businessFor("user_provisions", "provisions");

		assertEquals(0, policyRowsFor("provisions"), "no policy row before any calendar write");

		mockMvc.perform(setWeek(token, NINE_TO_FIVE))
				.andExpect(status().isOk());

		assertEquals(1, policyRowsFor("provisions"), "the week write must have provisioned it");
	}

	private int policyRowsFor(String slug) {
		return jdbcTemplate.queryForObject("""
				SELECT count(*) FROM availability_booking_policy p
				JOIN business_profile b ON b.id = p.business_id
				WHERE b.slug = ?""", Integer.class, slug);
	}

	/**
	 * Builds a full seven-day week. The contract insists on all seven, so a test that only
	 * cares about Monday still has to say something about Sunday.
	 *
	 * @param blocksPerDay the blocks array for Monday, Tuesday, … as far as the test needs.
	 *                     Whatever is left over is closed.
	 */
	private RequestBuilder setWeek(RequestPostProcessor token, String... blocksPerDay) {
		StringBuilder days = new StringBuilder();

		for (int day = 1; day <= 7; day++) {
			String blocks = day <= blocksPerDay.length ? blocksPerDay[day - 1] : "[]";
			days.append(day == 1 ? "" : ",")
					.append("{\"dayOfWeek\":").append(day).append(",\"blocks\":").append(blocks).append("}");
		}

		return put("/api/v1/me/business/working-hours").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"days\":[" + days + "]}");
	}

	private RequestBuilder setRules(RequestPostProcessor token, int version, String fields) {
		return put("/api/v1/me/business/booking-policy").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"version\":" + version + "," + fields + "}");
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
