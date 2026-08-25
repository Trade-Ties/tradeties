package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Step 2 reaches into step 7, and nothing on the form says so.
 *
 * <p>Working hours are local wall clock, so a new time zone does not move them: Monday 08:00
 * stays Monday 08:00. What moves is the instant behind it, and with it every free slot the
 * business offers. That is usually the point — a correction and a move are the two ordinary
 * reasons to change a zone, and in both the tradesperson still starts at eight — so this is a
 * confirmation and not a refusal.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TimeZoneChangeTests {

	private static final String PROBLEM_TYPE = "urn:tradeties:problem:unconfirmed-time-zone-change";

	@Autowired
	MockMvc mockMvc;

	/** The ordinary case: most zone changes happen in step 2, before step 7 exists. */
	@Test
	void changingTheZoneWithoutAWorkingWeekNeedsNoConfirmation() throws Exception {
		RequestPostProcessor token = businessFor("user_zone_no_hours", "zone-no-hours");

		mockMvc.perform(putProfile(token, "zone-no-hours", 0, "America/Chicago", null))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.timeZone").value("America/Chicago"));
	}

	/**
	 * With a week in place the question is worth asking, and the answer has to be tellable from
	 * every other 409 — hence the {@code type}. Matching on the sentence would break the first
	 * time somebody rewords it.
	 */
	@Test
	void changingTheZoneWithAWorkingWeekIsRefusedUntilConfirmed() throws Exception {
		RequestPostProcessor token = businessFor("user_zone_hours", "zone-hours");
		givenAWorkingWeek(token);

		mockMvc.perform(putProfile(token, "zone-hours", 0, "America/Chicago", null))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.type").value(PROBLEM_TYPE));

		// Refused means refused: nothing was written, and the version the client holds still fits.
		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.timeZone").value("America/Denver"))
				.andExpect(jsonPath("$.version").value(0));
	}

	@Test
	void theSameChangeGoesThroughOnceConfirmed() throws Exception {
		RequestPostProcessor token = businessFor("user_zone_confirms", "zone-confirms");
		givenAWorkingWeek(token);

		mockMvc.perform(putProfile(token, "zone-confirms", 0, "America/Chicago", null))
				.andExpect(status().isConflict());

		mockMvc.perform(putProfile(token, "zone-confirms", 0, "America/Chicago", true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.timeZone").value("America/Chicago"))
				.andExpect(jsonPath("$.version").value(1));
	}

	/**
	 * The write is a full replacement, so every update resends the zone. Treating that as a
	 * change would stop a business with working hours from ever correcting its phone number
	 * without answering a question about its calendar.
	 */
	@Test
	void resendingTheSameZoneIsNotAChangeAndIsNeverQuestioned() throws Exception {
		RequestPostProcessor token = businessFor("user_zone_same", "zone-same");
		givenAWorkingWeek(token);

		mockMvc.perform(putProfile(token, "zone-same", 0, "America/Denver", null))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.timeZone").value("America/Denver"));
	}

	/** Monday nine to five, the rest closed — the contract insists on all seven days. */
	private void givenAWorkingWeek(RequestPostProcessor token) throws Exception {
		StringBuilder days = new StringBuilder();

		for (int day = 1; day <= 7; day++) {
			days.append(day == 1 ? "" : ",")
					.append("{\"dayOfWeek\":").append(day).append(",\"blocks\":")
					.append(day == 1 ? "[{\"startsAt\":\"09:00\",\"endsAt\":\"17:00\"}]" : "[]")
					.append("}");
		}

		mockMvc.perform(put("/api/v1/me/business/working-hours").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"days\":[" + days + "]}"))
				.andExpect(status().isOk());
	}

	/** @param confirmed {@code null} leaves the field out entirely, which is what a client sends first */
	private RequestBuilder putProfile(RequestPostProcessor token, String slug, long version,
			String timeZone, Boolean confirmed) {

		return put("/api/v1/me/business").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "version": %d,
						  "slug": "%s",
						  "legalName": "Acme Plumbing LLC",
						  "displayName": "Acme Plumbing",
						  "phone": "+13035550101",
						  "email": "dispatch@acme.example",
						  "address": {
						    "street1": "123 Main St",
						    "city": "Denver",
						    "state": "CO",
						    "postalCode": "80202"
						  },
						  "timeZone": "%s",
						  "serviceRadiusMiles": 25%s
						}""".formatted(version, slug, timeZone,
						confirmed == null ? "" : ",\n  \"timeZoneChangeConfirmed\": " + confirmed));
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
