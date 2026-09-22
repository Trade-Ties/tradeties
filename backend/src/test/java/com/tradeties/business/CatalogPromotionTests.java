package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.hamcrest.Matchers;
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
 * Turning a collected phrase into a job the marketplace offers.
 *
 * <p>The half of the catalogue that cannot be automated, and the end of the arc: the search
 * collects what it cannot name, somebody reads it, and the answer takes effect without a
 * deployment. What these pin is that the taking effect is real — a promoted job is suggested to
 * customers and tickable by tradespeople from the moment the call returns.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CatalogPromotionTests {

	private static final String QUEUE = "/api/v1/admin/service-catalog-suggestions";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/**
	 * The role is granted out of band and never through a public endpoint, so this check is the
	 * whole of the gate. A signed-in customer is not staff.
	 */
	@Test
	void theQueueIsStaffOnly() throws Exception {
		RequestPostProcessor customer = BusinessFixtures.registeredTradesperson(mockMvc, "user_promo_outsider");

		mockMvc.perform(get(QUEUE).with(customer)).andExpect(status().isForbidden());
		mockMvc.perform(get(QUEUE)).andExpect(status().isUnauthorized());
	}

	/** Most asked first, because that is the only reason to open the list. */
	@Test
	void theQueueIsOrderedByHowOftenAPhraseWasAsked() throws Exception {
		RequestPostProcessor staff = staff("user_promo_order");
		search("my dumbwaiter cable snapped");
		search("my dumbwaiter cable snapped");
		search("my well pump lost its prime");

		String body = mockMvc.perform(get(QUEUE).with(staff).param("limit", "200"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		List<Integer> counts = JsonPath.read(body, "$[*].seenCount");
		assertDescending(counts);
	}

	/**
	 * The whole point, end to end: a phrase nobody could search for becomes one they can, and the
	 * catalogue grew while the application was running.
	 */
	@Test
	void promotingAPhraseMakesItSearchableImmediately() throws Exception {
		RequestPostProcessor staff = staff("user_promo_live");
		search("my chimney flue has a crack in it");

		String id = idOf(staff, "my chimney flue has a crack in it");
		String mason = BusinessFixtures.tradeId(mockMvc, "MASON");

		mockMvc.perform(put(QUEUE + "/" + id + "/promotion").with(staff)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"label": "Repair a cracked chimney flue", "tradeId": "%s", \
								"synonyms": "flue, cracked flue, smoke coming into the room"}"""
								.formatted(mason)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.label").value("Repair a cracked chimney flue"))
				.andExpect(jsonPath("$.code").value(Matchers.startsWith("MASON_")));

		// Suggested to a customer typing it, with no deployment in between.
		mockMvc.perform(get("/api/v1/service-catalog").param("q", "cracked flue"))
				.andExpect(jsonPath("$[?(@.label=='Repair a cracked chimney flue')]").exists());

		// And offered to a mason filling in their profile.
		mockMvc.perform(get("/api/v1/service-jobs"))
				.andExpect(jsonPath("$[?(@.label=='Repair a cracked chimney flue')]").exists());
	}

	/** The row is the record of where an entry came from, so it stops being part of the queue. */
	@Test
	void aPromotedPhraseLeavesTheQueueAndSaysWhereItWent() throws Exception {
		RequestPostProcessor staff = staff("user_promo_marked");
		search("my septic tank alarm keeps sounding");

		String id = idOf(staff, "my septic tank alarm keeps sounding");
		promote(staff, id, "Service a septic tank alarm", BusinessFixtures.tradeId(mockMvc, "PLUMBER"));

		mockMvc.perform(get(QUEUE).with(staff).param("status", "PROMOTED").param("limit", "200"))
				.andExpect(jsonPath(at(id) + ".promotedTo").value(Matchers.everyItem(Matchers.notNullValue())));

		mockMvc.perform(get(QUEUE).with(staff).param("limit", "200"))
				.andExpect(jsonPath(at(id)).value(Matchers.empty()));
	}

	/**
	 * Two people working the same list. The guard is in the statement rather than in a check
	 * before it, so the second one is told rather than quietly writing a duplicate entry.
	 */
	@Test
	void aPhraseCanOnlyBeDecidedOnce() throws Exception {
		RequestPostProcessor staff = staff("user_promo_twice");
		search("my radiator valve sheared off");

		String id = idOf(staff, "my radiator valve sheared off");
		promote(staff, id, "Replace a sheared radiator valve", BusinessFixtures.tradeId(mockMvc, "HVAC"));

		mockMvc.perform(put(QUEUE + "/" + id + "/promotion").with(staff)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"label": "Something else entirely", "tradeId": "%s"}"""
								.formatted(BusinessFixtures.tradeId(mockMvc, "HVAC"))))
				.andExpect(status().isConflict());
	}

	/**
	 * A label whose code is taken means the job already has an entry, and the phrase belongs
	 * against that one. Refused rather than given a second entry nobody would notice was a twin.
	 */
	@Test
	void aLabelThatWouldRepeatAnExistingJobIsRefused() throws Exception {
		RequestPostProcessor staff = staff("user_promo_clash");
		search("my toilet needs swapping out entirely");

		String id = idOf(staff, "my toilet needs swapping out entirely");

		mockMvc.perform(put(QUEUE + "/" + id + "/promotion").with(staff)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"label": "Replace a toilet", "tradeId": "%s"}"""
								.formatted(BusinessFixtures.tradeId(mockMvc, "PLUMBER"))))
				.andExpect(status().isConflict());
	}

	/** A typo is decided rather than deleted, so nobody has to decide it twice. */
	@Test
	void aDismissedPhraseLeavesTheQueueAndStays() throws Exception {
		RequestPostProcessor staff = staff("user_promo_junk");
		search("asdfgh qwerty zxcvb");

		String id = idOf(staff, "asdfgh qwerty zxcvb");

		mockMvc.perform(put(QUEUE + "/" + id + "/dismissal").with(staff)).andExpect(status().isNoContent());
		// Replayable: asking for a state it is already in is not a disagreement.
		mockMvc.perform(put(QUEUE + "/" + id + "/dismissal").with(staff)).andExpect(status().isNoContent());

		mockMvc.perform(get(QUEUE).with(staff).param("limit", "200"))
				.andExpect(jsonPath(at(id)).value(Matchers.empty()));
		mockMvc.perform(get(QUEUE).with(staff).param("status", "DISMISSED").param("limit", "200"))
				.andExpect(jsonPath(at(id)).exists());
	}

	private void promote(RequestPostProcessor staff, String id, String label, String tradeId) throws Exception {
		mockMvc.perform(put(QUEUE + "/" + id + "/promotion").with(staff)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"label\": \"" + label + "\", \"tradeId\": \"" + tradeId + "\"}"))
				.andExpect(status().isCreated());
	}

	private String idOf(RequestPostProcessor staff, String phrase) throws Exception {
		String body = mockMvc.perform(get(QUEUE).with(staff).param("limit", "200"))
				.andReturn().getResponse().getContentAsString();

		List<String> ids = JsonPath.read(body, "$[?(@.phrase=='" + phrase + "')].id");
		return ids.getFirst();
	}

	private void search(String description) throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", "80202").param("job", description))
				.andExpect(status().isOk());
	}

	private static String at(String id) {
		return "$[?(@.id=='" + id + "')]";
	}

	private static void assertDescending(List<Integer> counts) {
		for (int i = 1; i < counts.size(); i++) {
			if (counts.get(i) > counts.get(i - 1)) {
				throw new AssertionError("queue was not ordered by how often asked: " + counts);
			}
		}
	}

	/**
	 * Registered through the one intent there is, then granted the role with SQL — because no
	 * endpoint grants it and none may. The test reaches around the application exactly as far as
	 * an operator would, and no further.
	 *
	 * <p>That leaves these accounts holding a tradesperson role as well, which is beside the
	 * point: {@code requirePlatformAdmin} reads one role and the extra one proves nothing either
	 * way. {@link #theQueueIsStaffOnly} is where the absence of it is what matters.
	 */
	private RequestPostProcessor staff(String subject) throws Exception {
		RequestPostProcessor token = BusinessFixtures.registeredTradesperson(mockMvc, subject);

		jdbcTemplate.update("""
				INSERT INTO identity_user_role (user_id, role)
				SELECT id, 'PLATFORM_ADMIN' FROM identity_user WHERE workos_user_id = ?
				ON CONFLICT DO NOTHING
				""", subject);

		return token;
	}
}
