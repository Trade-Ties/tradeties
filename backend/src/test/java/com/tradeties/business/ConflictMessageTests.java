package com.tradeties.business;

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
 * What a 409 actually says.
 *
 * <p>The messages are asserted word for word, because that is the only part of a conflict a
 * person actually acts on — and because a handler that catches one Spring exception for five
 * situations gets the status right while saying the wrong thing about four of them, which no
 * status-code assertion notices.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ConflictMessageTests {

	private static final String PRICING_BODY = """
			"minimumBillableMinutes":60,"billingIncrementMinutes":15,
			"serviceCallFeeWaivedIfHired":false,"travelFeeMode":"INCLUDED",
			"materialPricingMode":"INCLUDED","cancellationFee":"0.0000",
			"cancellationNoticeHours":24""";

	@Autowired
	MockMvc mockMvc;

	@Test
	void aStaleProfileVersionNamesTheProfile() throws Exception {
		RequestPostProcessor token = businessFor("user_msg_profile", "msg-profile");

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(businessJson("msg-profile", "\"version\": 99,")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail")
						.value("Your profile changed since you loaded it. Reload and apply your edit again."));
	}

	/**
	 * A client handed "stored version is 5" will retry with 5, and that retry overwrites exactly
	 * the change it was being warned about.
	 */
	@Test
	void theStoredVersionIsNeverHandedBack() throws Exception {
		RequestPostProcessor token = businessFor("user_msg_leak", "msg-leak");

		String detail = JsonPath.read(mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(businessJson("msg-leak", "\"version\": 99,")))
				.andExpect(status().isConflict())
				.andReturn().getResponse().getContentAsString(), "$.detail");

		org.junit.jupiter.api.Assertions.assertFalse(detail.contains("0"),
				"the stored version leaked into: " + detail);
	}

	@Test
	void aStaleServiceVersionNamesTheService() throws Exception {
		RequestPostProcessor token = businessFor("user_msg_service", "msg-service");

		String serviceId = JsonPath.read(mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"Drain snake","estimatedDurationMinutes":60,"pricingMode":"QUOTE_ONLY"}"""))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString(), "$.id");

		mockMvc.perform(put("/api/v1/me/business/services/" + serviceId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":99,"name":"Renamed","estimatedDurationMinutes":60,
								 "pricingMode":"QUOTE_ONLY"}"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail")
						.value("This service changed since you loaded it. Reload and apply your edit again."));
	}

	@Test
	void aStaleLicenceVersionNamesTheLicence() throws Exception {
		RequestPostProcessor token = businessFor("user_msg_licence", "msg-licence");

		String licenseId = JsonPath.read(mockMvc.perform(post("/api/v1/me/business/licenses").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"state":"CO","licenseNumber":"PL-1234"}"""))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString(), "$.id");

		mockMvc.perform(put("/api/v1/me/business/licenses/" + licenseId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":99,"state":"CO","licenseNumber":"PL-9999"}"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail")
						.value("This licence changed since you loaded it. Reload and apply your edit again."));
	}

	/**
	 * The expensive one. `version` is optional on `PricingInput` because the first write has
	 * none, so forgetting it later is an easy mistake — and the answer used to be "reload the
	 * profile", which fixes nothing. The client has to be told to fetch the rates and send
	 * theirs.
	 */
	@Test
	void aMissingPricingVersionSaysToSendOne() throws Exception {
		RequestPostProcessor token = businessFor("user_msg_pricing_missing", "msg-pricing-missing");

		mockMvc.perform(setPricing(token, ""))
				.andExpect(status().isOk());

		mockMvc.perform(setPricing(token, ""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail")
						.value("Rates already exist. Send the version you last read to replace them."));
	}

	/** The message echoes the client's own number, which is their statement rather than ours. */
	@Test
	void aPricingVersionWithNothingStoredSaysToOmitIt() throws Exception {
		RequestPostProcessor token = businessFor("user_msg_pricing_early", "msg-pricing-early");

		mockMvc.perform(setPricing(token, "\"version\":0,"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail")
						.value("No rates are stored yet, so there is no version 0 to replace. "
								+ "Omit the version on the first write."));
	}

	@Test
	void aStalePricingVersionNamesTheRates() throws Exception {
		RequestPostProcessor token = businessFor("user_msg_pricing_stale", "msg-pricing-stale");

		mockMvc.perform(setPricing(token, ""))
				.andExpect(status().isOk());

		mockMvc.perform(setPricing(token, "\"version\":99,"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail")
						.value("Your rates changed since you loaded them. Reload and apply your edit again."));
	}

	private org.springframework.test.web.servlet.RequestBuilder setPricing(
			RequestPostProcessor token, String version) {

		return put("/api/v1/me/business/pricing").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{" + version + PRICING_BODY + "}");
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}

	private static String businessJson(String slug, String version) {
		return BusinessFixtures.businessJson(slug, version);
	}
}
