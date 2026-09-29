package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The landing page's "free in the next 48 hours" count, end to end and without a token.
 *
 * <p>Asserted as a difference rather than a figure: the suite shares one database, and other
 * classes publish businesses of their own. Every business here works around the clock, so which
 * day and hour the suite runs at decides nothing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MarketplaceSummaryTests {

	@Autowired
	MockMvc mockMvc;

	@Test
	void theWindowIsSentWithTheCount() throws Exception {
		mockMvc.perform(get("/api/v1/marketplace-summary"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.windowHours").value(48));
	}

	/** What most businesses will run with, and the reason the count is not "free today". */
	@Test
	void aBusinessThatNeedsADaysNoticeIsCounted() throws Exception {
		int before = freeWithinWindow();

		RequestPostProcessor token = publish("user_free_soon", "free-soon");
		openAroundTheClock(token);

		assertEquals(before + 1, freeWithinWindow());
	}

	/** Its soonest start is three days out, and the card would show nothing sooner. */
	@Test
	void aBusinessWhoseNoticeOutlastsTheWindowIsNot() throws Exception {
		int before = freeWithinWindow();

		RequestPostProcessor token = publish("user_free_later", "free-later");
		openAroundTheClock(token);
		requireNotice(token, 72);

		assertEquals(before, freeWithinWindow());
	}

	private int freeWithinWindow() throws Exception {
		String body = mockMvc.perform(get("/api/v1/marketplace-summary"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		return JsonPath.read(body, "$.freeWithinWindow");
	}

	private RequestPostProcessor publish(String subject, String slug) throws Exception {
		RequestPostProcessor token = BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);

		mockMvc.perform(post("/api/v1/me/business/publish").with(token)).andExpect(status().isOk());

		return token;
	}

	private void openAroundTheClock(RequestPostProcessor token) throws Exception {
		StringBuilder days = new StringBuilder();
		for (int day = 1; day <= 7; day++) {
			days.append(day == 1 ? "" : ",")
					.append("{\"dayOfWeek\":").append(day)
					.append(",\"blocks\":[{\"startsAt\":\"00:00\",\"endsAt\":\"24:00\"}]}");
		}

		mockMvc.perform(put("/api/v1/me/business/working-hours").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"days\":[" + days + "]}"))
				.andExpect(status().isOk());
	}

	private void requireNotice(RequestPostProcessor token, int hours) throws Exception {
		String rules = mockMvc.perform(get("/api/v1/me/business/booking-policy").with(token))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		mockMvc.perform(put("/api/v1/me/business/booking-policy").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":%d,"bookingHorizonDays":30,"minLeadTimeHours":%d,
								 "slotGranularityMinutes":30,"appointmentBufferMinutes":0}"""
								.formatted((Integer) JsonPath.read(rules, "$.version"), hours)))
				.andExpect(status().isOk());
	}
}
