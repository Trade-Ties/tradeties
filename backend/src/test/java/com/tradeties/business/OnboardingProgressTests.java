package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

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
 * Where the wizard resumes.
 *
 * <p>The value is advisory: publishing is gated by the checklist in {@code PublishService} and
 * never by this number. It is also the only thing the wizard has to go on, so a marker stuck at 2
 * until publication puts a tradesperson back on the address form after four saved steps.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class OnboardingProgressTests {

	@Autowired
	MockMvc mockMvc;

	@Test
	void theMarkerFollowsTheWizardStepByStep() throws Exception {
		RequestPostProcessor token = businessFor("user_wizard_walk", "wizard-walk");
		assertStep(token, 2);

		setTrades(token);
		assertStep(token, 3);

		addService(token, "Clog removal");
		assertStep(token, 4);

		setPricing(token);
		assertStep(token, 5);

		addLicense(token, "PL-1001");
		assertStep(token, 6);

		setWorkingHours(token);
		assertStep(token, 7);

		setBookingPolicy(token);
		assertStep(token, 8);

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk());
		assertStep(token, 9);
	}

	/**
	 * The regression this implementation exists to avoid, and the reason the marker is written
	 * with a bulk update rather than through the entity.
	 *
	 * <p>{@code business_profile} carries {@code @Version}. Had the step been set on the loaded
	 * entity, every one of the writes below would have incremented it — and the version the
	 * wizard read back on step 2 would be stale by step 3. Going back to correct the address
	 * would then answer 409 about a change nobody made, which is a worse bug than the one being
	 * fixed and would have looked like a race.
	 *
	 * <p>The last call is the proof: the same version the client held all along still works.
	 */
	@Test
	void savingALaterStepLeavesTheProfileVersionAlone() throws Exception {
		RequestPostProcessor token = businessFor("user_wizard_version", "wizard-version");

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.version").value(0));

		setTrades(token);
		addService(token, "Drain snake");
		setPricing(token);
		setWorkingHours(token);
		setBookingPolicy(token);

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.onboardingCompletedStep").value(8))
				.andExpect(jsonPath("$.version").value(0));

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(businessJson("wizard-version", "\"version\": 0,")))
				.andExpect(status().isOk())
				// Correcting step 2 is a correction, not a return to it.
				.andExpect(jsonPath("$.onboardingCompletedStep").value(8));
	}

	/**
	 * The {@code WHERE onboarding_completed_step &lt; :step} is what makes it so: a published
	 * profile whose owner adds a second trade has not gone back to step 3.
	 */
	@Test
	void theMarkerNeverGoesBackwards() throws Exception {
		RequestPostProcessor token = businessFor("user_wizard_backwards", "wizard-backwards");

		setTrades(token);
		addService(token, "Clog removal");
		setPricing(token);
		setWorkingHours(token);

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk());
		assertStep(token, 9);

		setTrades(token);
		assertStep(token, 9);
	}

	/**
	 * Step 6 is the one step that may legitimately stay empty — plenty of trades need no
	 * licence. Only a write records a step, so somebody who looks at that form and moves on
	 * reaches 6 by saving 7, and the wizard resumes past it rather than in front of it.
	 */
	@Test
	void skippingTheOptionalLicenceStepStillReachesSeven() throws Exception {
		RequestPostProcessor token = businessFor("user_wizard_no_licence", "wizard-no-licence");

		setTrades(token);
		addService(token, "Clog removal");
		setPricing(token);
		setWorkingHours(token);

		assertStep(token, 7);
	}

	private void assertStep(RequestPostProcessor token, int expected) throws Exception {
		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.onboardingCompletedStep").value(expected));
	}

	private void setTrades(RequestPostProcessor token) throws Exception {
		String catalogue = mockMvc.perform(get("/api/v1/trades"))
				.andReturn().getResponse().getContentAsString();
		List<String> plumber = JsonPath.read(catalogue, "$[?(@.code=='PLUMBER')].id");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"primaryTradeId":"%s","additionalTradeIds":[]}""".formatted(plumber.getFirst())))
				.andExpect(status().isOk());
	}

	private void addService(RequestPostProcessor token, String name) throws Exception {
		mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"%s","estimatedDurationMinutes":60,
								 "pricingMode":"STARTING_AT","price":"149.00"}""".formatted(name)))
				.andExpect(status().isCreated());
	}

	/** Always the first write, so the version is deliberately omitted. */
	private void setPricing(RequestPostProcessor token) throws Exception {
		mockMvc.perform(put("/api/v1/me/business/pricing").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"minimumBillableMinutes":60,"billingIncrementMinutes":15,
								 "serviceCallFeeWaivedIfHired":false,"travelFeeMode":"INCLUDED",
								 "materialPricingMode":"INCLUDED","cancellationFee":"50.00",
								 "cancellationNoticeHours":24}"""))
				.andExpect(status().isOk());
	}

	private void addLicense(RequestPostProcessor token, String licenseNumber) throws Exception {
		mockMvc.perform(post("/api/v1/me/business/licenses").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"state":"CO","licenseNumber":"%s"}""".formatted(licenseNumber)))
				.andExpect(status().isCreated());
	}

	/** Monday nine to five, the other six days closed — the contract insists on all seven. */
	private void setWorkingHours(RequestPostProcessor token) throws Exception {
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

	/** Version 0: the policy row is provisioned with defaults, so the first write replaces those. */
	private void setBookingPolicy(RequestPostProcessor token) throws Exception {
		mockMvc.perform(put("/api/v1/me/business/booking-policy").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":0,"bookingHorizonDays":30,"minLeadTimeHours":4,
								 "slotGranularityMinutes":15,"appointmentBufferMinutes":30}"""))
				.andExpect(status().isOk());
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}

	private static String businessJson(String slug, String version) {
		return BusinessFixtures.businessJson(slug, version);
	}
}
