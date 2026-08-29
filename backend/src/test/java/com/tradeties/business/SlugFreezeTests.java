package com.tradeties.business;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The profile URL, and the moment it stops being the holder's to change.
 *
 * <p>Beside {@link PublishTests} rather than inside it, because publishing is only where this
 * rule starts. What is checked here is an address that outlives every state the profile passes
 * through afterwards — including the draft it goes back to.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SlugFreezeTests {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/**
	 * The rule the whole slug design rests on.
	 *
	 * <p>A draft is not searchable, so no copy of its URL can exist yet and changing it costs
	 * nobody anything. Publishing turns the same string into an address that goes on a van and into
	 * a customer's phone — copies this API will never see again — so that is where it stops being
	 * editable.
	 */
	@Test
	void publishingFixesTheProfileUrl() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_locks_url", "locks-url");

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.slugLocked").value(false));

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slugLocked").value(true));

		// Sending the stored slug back is not a change, and has to keep working: the update is a
		// full replacement, so the slug is in every body whether or not anybody touched it.
		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.businessJson("locks-url", storedVersion(token))))
				.andExpect(status().isOk());

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.businessJson("locks-url-renamed", storedVersion(token))))
				.andExpect(status().isConflict())
				// The address they already gave out, not the one they asked for: that is the thing
				// the refusal is protecting, and the only one worth naming back.
				.andExpect(jsonPath("$.detail").value(containsString("tradeties.com/pro/locks-url")));

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.slug").value("locks-url"));
	}

	/** Before publishing, second thoughts about the URL are free — and common. */
	@Test
	void aDraftCanStillChangeItsProfileUrl() throws Exception {
		RequestPostProcessor token = businessFor("user_draft_url", "draft-url");

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.businessJson("draft-url-reconsidered", storedVersion(token))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slug").value("draft-url-reconsidered"))
				.andExpect(jsonPath("$.slugLocked").value(false));
	}

	/**
	 * The case a status flag alone would get wrong. Unpublishing reports {@code DRAFT} again, and
	 * a profile that was live for a year then looks exactly like one that never was — while every
	 * link handed out in that year is still in circulation.
	 */
	@Test
	void goingOfflineDoesNotHandTheUrlBack() throws Exception {
		RequestPostProcessor token = completeBusinessFor("user_offline_url", "offline-url");

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk());

		OffsetDateTime firstPublished = firstPublishedAt("offline-url");

		mockMvc.perform(post("/api/v1/me/business/unpublish").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DRAFT"))
				.andExpect(jsonPath("$.slugLocked").value(true));

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(BusinessFixtures.businessJson("offline-url-renamed", storedVersion(token))))
				.andExpect(status().isConflict());

		mockMvc.perform(post("/api/v1/me/business/publish").with(token))
				.andExpect(status().isOk());

		// And the second publish does not restamp it. The address went out the first time; a
		// business that closed for three weeks has not been given a fresh start on it.
		assertEquals(firstPublished, firstPublishedAt("offline-url"));
	}

	/**
	 * The row-local half of the freeze, which is the only half a constraint can express.
	 *
	 * <p>Nothing in Java sets {@code SUSPENDED}, so this table's status is already moved by
	 * hand-written SQL — the suspension tests in {@link PublishTests} do it themselves. The day one
	 * of those statements switches a profile back on instead of off, the CHECK is what stops a
	 * live, indexed business ending up with a freely editable URL and nothing on any screen saying
	 * so.
	 */
	@Test
	void aProfileCannotBeMadeLiveWithoutRecordingThatItWent() throws Exception {
		businessFor("user_raw_publish", "raw-publish");

		assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update(
				"UPDATE business_profile SET status = 'PUBLISHED' WHERE slug = 'raw-publish'"));
	}

	/**
	 * The assumption the migration's backfill rests on, stated where it can fail.
	 *
	 * <p>"Switched off" sounds like it must first have been on, and for a profile the marketplace
	 * suspended it usually was. But suspension is applied out of band, so it can land on a draft
	 * that never published — and a backfill reading it as evidence of publication would freeze the
	 * URL of a profile no customer has ever seen, permanently and with no way back.
	 */
	@Test
	void aSuspendedDraftHasNeverGivenItsUrlOut() throws Exception {
		RequestPostProcessor token = businessFor("user_suspended_url", "suspended-url");

		jdbcTemplate.update(
				"UPDATE business_profile SET status = 'SUSPENDED' WHERE slug = 'suspended-url'");

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(jsonPath("$.status").value("SUSPENDED"))
				.andExpect(jsonPath("$.slugLocked").value(false));
	}

	private OffsetDateTime firstPublishedAt(String slug) {
		return jdbcTemplate.queryForObject(
				"SELECT first_published_at FROM business_profile WHERE slug = ?",
				OffsetDateTime.class, slug);
	}

	/** The stored {@code version}, as the fragment {@code businessJson} splices into a body. */
	private String storedVersion(RequestPostProcessor token) throws Exception {
		String profile = mockMvc.perform(get("/api/v1/me/business").with(token))
				.andReturn().getResponse().getContentAsString();

		return "\"version\": " + JsonPath.read(profile, "$.version") + ",";
	}

	private RequestPostProcessor completeBusinessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.publishableBusinessFor(mockMvc, subject, slug);
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
