package com.tradeties.business;

import static org.hamcrest.Matchers.containsString;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Onboarding step 5.
 *
 * <p>Most of what is worth testing here is the set of combinations the contract cannot
 * describe: a travel mode governs two amounts, a material mode governs one, and a waiver
 * needs something to waive. All three are CHECK constraints in the schema, so without a
 * service-level check they arrive as a 500 with a constraint name in it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PricingTests {

	private static final String TRAVEL_INCLUDED = "\"travelFeeMode\":\"INCLUDED\"";
	private static final String MATERIAL_INCLUDED = "\"materialPricingMode\":\"INCLUDED\"";
	private static final String NO_WAIVER = "\"serviceCallFeeWaivedIfHired\":false";

	@Autowired
	MockMvc mockMvc;

	@Test
	void thereAreNoRatesBeforeStepFive() throws Exception {
		RequestPostProcessor token = businessFor("user_no_rates", "no-rates");

		mockMvc.perform(get("/api/v1/me/business/pricing").with(token))
				.andExpect(status().isNotFound());
	}

	@Test
	void theFirstWriteCreatesTheBlockAtVersionZero() throws Exception {
		RequestPostProcessor token = businessFor("user_first_rates", "first-rates");

		mockMvc.perform(setPricing(token, null, TRAVEL_INCLUDED, MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.currency").value("USD"))
				.andExpect(jsonPath("$.version").value(0))
				.andExpect(jsonPath("$.cancellationFee").value("50.0000"));

		mockMvc.perform(get("/api/v1/me/business/pricing").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.minimumBillableMinutes").value(60));
	}

	/** Sending a version when nothing is stored claims to replace something that is not there. */
	@Test
	void aVersionOnTheFirstWriteIsAConflict() throws Exception {
		RequestPostProcessor token = businessFor("user_early_version", "early-version");

		mockMvc.perform(setPricing(token, 0L, TRAVEL_INCLUDED, MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isConflict());
	}

	/** And omitting it on the second write claims nothing is stored, when something is. */
	@Test
	void omittingTheVersionOnAReplacementIsAConflict() throws Exception {
		RequestPostProcessor token = businessFor("user_missing_version", "missing-version");

		mockMvc.perform(setPricing(token, null, TRAVEL_INCLUDED, MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isOk());

		mockMvc.perform(setPricing(token, null, TRAVEL_INCLUDED, MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isConflict());
	}

	/**
	 * The reason the write is a replacement. Moving from a flat travel fee to a per-mile rate
	 * has to clear the flat amount — leaving it behind is what the database refuses, and what
	 * would resurface on the next switch back.
	 */
	@Test
	void switchingTheTravelModeClearsTheAmountItNoLongerGoverns() throws Exception {
		RequestPostProcessor token = businessFor("user_switches_travel", "switches-travel");

		mockMvc.perform(setPricing(token, null,
						"\"travelFeeMode\":\"FLAT\",\"travelFlatFee\":\"45.00\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.travelFlatFee").value("45.0000"));

		mockMvc.perform(setPricing(token, 0L,
						"\"travelFeeMode\":\"PER_MILE\",\"travelRatePerMile\":\"1.25\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.travelFlatFee").doesNotExist())
				.andExpect(jsonPath("$.travelRatePerMile").value("1.2500"));
	}

	@Test
	void aFlatTravelModeWithoutAnAmountIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_flat_no_amount", "flat-no-amount");

		mockMvc.perform(setPricing(token, null, "\"travelFeeMode\":\"FLAT\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isBadRequest());
	}

	@Test
	void includedTravelMustNotCarryAnAmount() throws Exception {
		RequestPostProcessor token = businessFor("user_included_amount", "included-amount");

		mockMvc.perform(setPricing(token, null,
						TRAVEL_INCLUDED + ",\"travelFlatFee\":\"45.00\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isBadRequest());
	}

	@Test
	void aMarkupOnlyBelongsToCostPlusMarkup() throws Exception {
		RequestPostProcessor token = businessFor("user_stray_markup", "stray-markup");

		mockMvc.perform(setPricing(token, null, TRAVEL_INCLUDED,
						"\"materialPricingMode\":\"AT_COST\",\"materialMarkupPercent\":\"15.00\"", NO_WAIVER))
				.andExpect(status().isBadRequest());
	}

	@Test
	void costPlusMarkupNeedsAPercentage() throws Exception {
		RequestPostProcessor token = businessFor("user_no_markup", "no-markup");

		mockMvc.perform(setPricing(token, null, TRAVEL_INCLUDED,
						"\"materialPricingMode\":\"COST_PLUS_MARKUP\"", NO_WAIVER))
				.andExpect(status().isBadRequest());
	}

	@Test
	void aMarkupIsStoredAtTwoDecimals() throws Exception {
		RequestPostProcessor token = businessFor("user_markup", "markup");

		mockMvc.perform(setPricing(token, null, TRAVEL_INCLUDED,
						"\"materialPricingMode\":\"COST_PLUS_MARKUP\",\"materialMarkupPercent\":\"15\"", NO_WAIVER))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.materialMarkupPercent").value("15.00"));
	}

	@Test
	void waivingAFeeThatDoesNotExistIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_empty_waiver", "empty-waiver");

		mockMvc.perform(setPricing(token, null, TRAVEL_INCLUDED, MATERIAL_INCLUDED,
						"\"serviceCallFeeWaivedIfHired\":true"))
				.andExpect(status().isBadRequest());
	}

	/** Caught by the contract's pattern, before any of the above runs. */
	@Test
	void aNegativeAmountNeverReachesTheService() throws Exception {
		RequestPostProcessor token = businessFor("user_negative", "negative");

		mockMvc.perform(setPricing(token, null,
						TRAVEL_INCLUDED + ",\"hourlyRate\":\"-10.00\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isBadRequest());
	}

	/**
	 * What the ceilings exist for: $89 an hour with the point two places out. $8,900 fits the
	 * column and passes the contract's pattern, so nothing before this sees anything wrong
	 * with it — and a shared string type cannot carry a per-field maximum to catch it either.
	 */
	@Test
	void aMisplacedDecimalPointInAnHourlyRateIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_shifted_rate", "shifted-rate");

		mockMvc.perform(setPricing(token, null,
						TRAVEL_INCLUDED + ",\"hourlyRate\":\"8900.00\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value(containsString("Did you mean 89.00?")));
	}

	/**
	 * And why the ceiling sits where it does rather than at the top of the usual range.
	 * Unusual is not impossible, and refusing a specialist mid-onboarding costs more than a
	 * typo its own author reads back on the next screen.
	 */
	@Test
	void anUnusuallyHighButRealHourlyRateIsAccepted() throws Exception {
		RequestPostProcessor token = businessFor("user_high_rate", "high-rate");

		mockMvc.perform(setPricing(token, null,
						TRAVEL_INCLUDED + ",\"hourlyRate\":\"750.00\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hourlyRate").value("750.0000"));
	}

	/**
	 * Per mile carries the tightest ceiling and needs to. Real rates live under $5, so a
	 * slipped $0.65 arrives as $65 — small enough that a bound set for hourly rates would
	 * wave it straight through.
	 */
	@Test
	void aSlippedRatePerMileIsRejectedAlthoughTheNumberLooksSmall() throws Exception {
		RequestPostProcessor token = businessFor("user_shifted_mile", "shifted-mile");

		mockMvc.perform(setPricing(token, null,
						"\"travelFeeMode\":\"PER_MILE\",\"travelRatePerMile\":\"65.00\"",
						MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value(containsString("Did you mean 0.65?")));
	}

	/** Inclusive, so the round number somebody is most likely to pick is not the one refused. */
	@Test
	void theCeilingItselfIsStillAllowed() throws Exception {
		RequestPostProcessor token = businessFor("user_at_ceiling", "at-ceiling");

		mockMvc.perform(setPricing(token, null,
						TRAVEL_INCLUDED + ",\"hourlyRate\":\"2000.00\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isOk());
	}

	/**
	 * Sixteen digits before the point, which no column here can hold — `NUMERIC(19,4)` stops at
	 * fifteen. The regression is the layer it is caught in: while the pattern said `\d+` and
	 * capped only the string length, this passed validation, reached PostgreSQL, and came back
	 * as an untranslated integrity violation, which is a 500.
	 */
	@Test
	void anAmountWiderThanTheColumnIsRejectedBeforeTheDatabase() throws Exception {
		RequestPostProcessor token = businessFor("user_too_wide", "too-wide");

		mockMvc.perform(setPricing(token, null,
						TRAVEL_INCLUDED + ",\"hourlyRate\":\"9999999999999999\"", MATERIAL_INCLUDED, NO_WAIVER))
				.andExpect(status().isBadRequest());
	}

	private org.springframework.test.web.servlet.RequestBuilder setPricing(
			RequestPostProcessor token, Long version, String... fields) {

		return put("/api/v1/me/business/pricing").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  %s
						  "minimumBillableMinutes": 60,
						  "billingIncrementMinutes": 15,
						  "cancellationFee": "50.00",
						  "cancellationNoticeHours": 24,
						  %s
						}""".formatted(
						version == null ? "" : "\"version\": " + version + ",",
						String.join(",", fields)));
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
