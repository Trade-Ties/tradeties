package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Onboarding step 6.
 *
 * <p>Optional, self-contained, and interesting for exactly one rule: the verification mark
 * confirms a specific combination, so editing that combination has to withdraw it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class LicenseTests {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	void aBusinessStartsWithNoLicences() throws Exception {
		RequestPostProcessor token = businessFor("user_no_licences", "no-licences");

		mockMvc.perform(get("/api/v1/me/business/licenses").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void aLicenceIsStoredUnverified() throws Exception {
		RequestPostProcessor token = businessFor("user_adds_licence", "adds-licence");

		mockMvc.perform(addLicense(token, "CO", "PL-12345", "Master Plumber"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.state").value("CO"))
				.andExpect(jsonPath("$.licenseNumber").value("PL-12345"))
				.andExpect(jsonPath("$.verifiedAt").doesNotExist())
				.andExpect(jsonPath("$.version").value(0));
	}

	/** A tradesperson near a state line legally works in two, which is why this is a list. */
	@Test
	void theSameNumberInAnotherStateIsAnotherLicence() throws Exception {
		RequestPostProcessor token = businessFor("user_two_states", "two-states");

		mockMvc.perform(addLicense(token, "CO", "PL-12345", "Master Plumber"))
				.andExpect(status().isCreated());

		mockMvc.perform(addLicense(token, "WY", "PL-12345", "Master Plumber"))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/me/business/licenses").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));
	}

	@Test
	void theSameNumberInTheSameStateIsADuplicate() throws Exception {
		RequestPostProcessor token = businessFor("user_dup_licence", "dup-licence");

		mockMvc.perform(addLicense(token, "CO", "PL-12345", "Master Plumber"))
				.andExpect(status().isCreated());

		mockMvc.perform(addLicense(token, "CO", "PL-12345", "Journeyman"))
				.andExpect(status().isConflict());
	}

	@Test
	void aLicenceCannotExpireBeforeItWasIssued() throws Exception {
		RequestPostProcessor token = businessFor("user_bad_dates", "bad-dates");

		mockMvc.perform(post("/api/v1/me/business/licenses").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"state":"CO","licenseNumber":"PL-1","issuedOn":"2026-01-01","expiresOn":"2025-01-01"}"""))
				.andExpect(status().isBadRequest());
	}

	@Test
	void anUnknownStateIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_bad_state", "bad-state");

		mockMvc.perform(addLicense(token, "XX", "PL-1", null))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The rule worth having. {@code verifiedAt} confirms one exact combination of state,
	 * number and type — leaving it in place after any of them changes would let an unchecked
	 * number wear the previous one's seal.
	 */
	@Test
	void changingTheNumberWithdrawsTheVerification() throws Exception {
		RequestPostProcessor token = businessFor("user_verified", "verified");

		String body = mockMvc.perform(addLicense(token, "CO", "PL-12345", "Master Plumber"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String licenseId = JsonPath.read(body, "$.id");

		// No verification flow exists yet, so the mark is set the way an operator would.
		jdbcTemplate.update("UPDATE business_license SET verified_at = now() WHERE id = ?::uuid", licenseId);

		mockMvc.perform(get("/api/v1/me/business/licenses").with(token))
				.andExpect(jsonPath("$[0].verifiedAt").exists());

		mockMvc.perform(put("/api/v1/me/business/licenses/" + licenseId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":0,"state":"CO","licenseNumber":"PL-99999","licenseType":"Master Plumber"}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.licenseNumber").value("PL-99999"))
				.andExpect(jsonPath("$.verifiedAt").doesNotExist());
	}

	/** Renewing extends the same licence — it is still the number that was checked. */
	@Test
	void changingOnlyTheExpiryKeepsTheVerification() throws Exception {
		RequestPostProcessor token = businessFor("user_renews", "renews");

		String body = mockMvc.perform(addLicense(token, "CO", "PL-12345", "Master Plumber"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String licenseId = JsonPath.read(body, "$.id");

		jdbcTemplate.update("UPDATE business_license SET verified_at = now() WHERE id = ?::uuid", licenseId);

		mockMvc.perform(put("/api/v1/me/business/licenses/" + licenseId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":0,"state":"CO","licenseNumber":"PL-12345",
								 "licenseType":"Master Plumber","expiresOn":"2030-12-31"}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.expiresOn").value("2030-12-31"))
				.andExpect(jsonPath("$.verifiedAt").exists());
	}

	@Test
	void aStaleVersionIsRejected() throws Exception {
		RequestPostProcessor token = businessFor("user_stale_licence", "stale-licence");

		String body = mockMvc.perform(addLicense(token, "CO", "PL-1", null))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String licenseId = JsonPath.read(body, "$.id");

		mockMvc.perform(put("/api/v1/me/business/licenses/" + licenseId).with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"version":99,"state":"CO","licenseNumber":"PL-2"}"""))
				.andExpect(status().isConflict());
	}

	@Test
	void removingReallyDeletes() throws Exception {
		RequestPostProcessor token = businessFor("user_removes_licence", "removes-licence");

		String body = mockMvc.perform(addLicense(token, "CO", "PL-1", null))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String licenseId = JsonPath.read(body, "$.id");

		mockMvc.perform(delete("/api/v1/me/business/licenses/" + licenseId).with(token))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business/licenses").with(token))
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void someoneElsesLicenceIsIndistinguishableFromAMissingOne() throws Exception {
		RequestPostProcessor owner = businessFor("user_licence_owner", "licence-owner");

		String body = mockMvc.perform(addLicense(owner, "CO", "PL-1", null))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String licenseId = JsonPath.read(body, "$.id");

		RequestPostProcessor stranger = businessFor("user_licence_stranger", "licence-stranger");

		mockMvc.perform(delete("/api/v1/me/business/licenses/" + licenseId).with(stranger))
				.andExpect(status().isNotFound());
	}

	/** Not what a plain {@code DESC} does in PostgreSQL, where nulls sort first. */
	@Test
	void licencesAreOrderedByExpiryWithOpenEndedOnesLast() throws Exception {
		RequestPostProcessor token = businessFor("user_orders_licences", "orders-licences");

		mockMvc.perform(post("/api/v1/me/business/licenses").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"state":"CO","licenseNumber":"SOON","expiresOn":"2027-01-01"}"""))
				.andExpect(status().isCreated());

		mockMvc.perform(addLicense(token, "WY", "OPEN", null))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business/licenses").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"state":"TX","licenseNumber":"LATER","expiresOn":"2031-01-01"}"""))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/me/business/licenses").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].licenseNumber").value("LATER"))
				.andExpect(jsonPath("$[1].licenseNumber").value("SOON"))
				.andExpect(jsonPath("$[2].licenseNumber").value("OPEN"));
	}

	private org.springframework.test.web.servlet.RequestBuilder addLicense(
			RequestPostProcessor token, String state, String number, String type) {

		return post("/api/v1/me/business/licenses").with(token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"state":"%s","licenseNumber":"%s"%s}"""
						.formatted(state, number, type == null ? "" : ",\"licenseType\":\"" + type + "\""));
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
