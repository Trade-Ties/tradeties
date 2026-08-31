package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.TestcontainersConfiguration;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Paging, and the cap behind it.
 *
 * <p><strong>Two results a page and three results in total</strong>, set here rather than taken
 * from {@code application.yml}. The shipped numbers are 24 and 240, and reaching the cap with
 * those would mean publishing 241 businesses to assert one boolean. Shrinking them tests the same
 * arithmetic with four — and the cap deliberately is not a whole number of pages, because a last
 * page cut short by the cap rather than by the data is exactly the case an off-by-one hides in.
 *
 * <p><strong>Every case narrows by name.</strong> The suite shares one database and other classes
 * publish businesses of their own, so a test that counted everything at 80202 would pass or fail
 * on the order the suite ran in. A name only this test uses turns the shared table into a private
 * one, and the count in the answer becomes something a test can predict.
 *
 * <p>Which is why each test searches for the <em>second</em> word of its fixtures' name, never
 * "Zaltana". The first word is shared, and {@code %>} matches any run of the stored name — so
 * narrowing by it collects every group in this class and every count here becomes a race with the
 * order the tests ran in.
 *
 * <p>Every business here stands at the same ZIP centroid, so every distance is identical and the
 * order rests entirely on the slug tiebreak. That is the point rather than a simplification: it is
 * the arrangement under which a missing tiebreak would put one business on two pages and another
 * on none, and it is what {@link #everyPageTogetherIsTheCountThatWasPromised} would catch.
 */
@SpringBootTest(properties = {
		"tradeties.search.page-size=2",
		"tradeties.search.max-results=3"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BusinessSearchPagingTests {

	private static final String DENVER = "80202";

	private static final int PAGE_SIZE = 2;
	private static final int CAP = 3;

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	/** What a page is, said in the four numbers a client needs to draw a pager. */
	@Test
	void aPageCarriesAtMostItsSizeAndDescribesItself() throws Exception {
		givenPublishedBusinesses("Zaltana Pagers", "paging-first", 3);

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "Pagers"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results", Matchers.hasSize(PAGE_SIZE)))
				.andExpect(jsonPath("$.page").value(1))
				.andExpect(jsonPath("$.pageSize").value(PAGE_SIZE))
				.andExpect(jsonPath("$.total").value(3))
				.andExpect(jsonPath("$.totalCapped").value(false));
	}

	/** An absent page is the first one, so a client that never learns about paging still works. */
	@Test
	void anAbsentPageIsTheFirst() throws Exception {
		givenPublishedBusinesses("Zaltana Defaults", "paging-default", 3);

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "Defaults"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.page").value(1))
				.andExpect(jsonPath("$.results", Matchers.hasSize(PAGE_SIZE)));
	}

	/**
	 * The second page carries what the first did not, and nothing it already did.
	 *
	 * <p>The overlap is the half worth asserting. Every one of these businesses sits on the same
	 * centroid, so distance orders none of them; without {@code b.slug} in the {@code ORDER BY},
	 * PostgreSQL may return them in any order it likes and each page would be a fresh shuffle of
	 * the same three rows.
	 */
	@Test
	void theSecondPageContinuesWhereTheFirstStopped() throws Exception {
		givenPublishedBusinesses("Zaltana Seconds", "paging-second", 3);

		List<String> first = slugsOn("Seconds", 1);
		List<String> second = slugsOn("Seconds", 2);

		assertEquals(PAGE_SIZE, first.size());
		assertEquals(1, second.size(), "the last page carries what is left, not a full page");

		Set<String> together = new HashSet<>(first);
		together.addAll(second);
		assertEquals(3, together.size(), "a business appeared on two pages, or on none");
	}

	/**
	 * The drift guard for the two queries.
	 *
	 * <p>{@code findServing} fetches pages and {@code countServing} counts them, and the same
	 * {@code WHERE} clause is written out in both with nothing keeping them in step. A filter
	 * added to one and forgotten in the other raises no error — the list simply stops agreeing
	 * with the headline above it. Walking every page and comparing the tally to {@code total} is
	 * what turns that silence into a red build.
	 */
	@Test
	void everyPageTogetherIsTheCountThatWasPromised() throws Exception {
		givenPublishedBusinesses("Zaltana Tallies", "paging-tally", 3);

		String body = search("Tallies", 1);
		int total = JsonPath.read(body, "$.total");

		List<String> collected = new ArrayList<>(slugsOn("Tallies", 1));
		for (int page = 2; page <= CAP; page++) {
			collected.addAll(slugsOn("Tallies", page));
		}

		assertEquals(total, collected.size(), "the pages and the count disagree");
		assertEquals(total, new HashSet<>(collected).size(), "a business was paged twice");
	}

	/**
	 * Past the cap the count stops counting and says that it did.
	 *
	 * <p>Four businesses against a cap of three. {@code total} is the cap rather than four, which
	 * on its own would be a lie — {@code totalCapped} is what turns it into "at least this many",
	 * and it is the difference between a client rendering "3" and "3+".
	 */
	@Test
	void theCountStopsAtTheCapAndSaysSo() throws Exception {
		givenPublishedBusinesses("Zaltana Ceilings", "paging-cap", CAP + 1);

		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("name", "Ceilings"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(CAP))
				.andExpect(jsonPath("$.totalCapped").value(true));
	}

	/** And what the cap costs: the business past it cannot be reached from any page. */
	@Test
	void nothingPastTheCapIsReachable() throws Exception {
		givenPublishedBusinesses("Zaltana Unreachables", "paging-unreach", CAP + 1);

		List<String> collected = new ArrayList<>();
		for (int page = 1; page <= CAP + 2; page++) {
			collected.addAll(slugsOn("Unreachables", page));
		}

		assertEquals(CAP, collected.size(), "paging reached further than the cap allows");
	}

	/**
	 * A page past the end answers with an empty one, not a refusal.
	 *
	 * <p>The client asked a question the contract permits about a list that exists, and the count
	 * it already holds says where that list ended. A 400 here would call a legal question a bug,
	 * and a client re-checking its own postal code is the wrong lesson — the same one an unknown
	 * ZIP answered as an empty result would teach.
	 */
	@Test
	void aPagePastTheEndIsEmptyRatherThanRefused() throws Exception {
		givenPublishedBusinesses("Zaltana Ends", "paging-end", 3);

		mockMvc.perform(get("/api/v1/businesses")
						.param("zip", DENVER)
						.param("name", "Ends")
						.param("page", "3"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.results", Matchers.empty()))
				.andExpect(jsonPath("$.page").value(3))
				.andExpect(jsonPath("$.total").value(3));
	}

	/**
	 * Past the contract's last page is a different answer, and untyped like every other malformed
	 * parameter. The bound exists so that no offset the server never meant to serve can be asked
	 * for at all, and it is refused before anything runs.
	 */
	@Test
	void aPagePastTheContractsLastIsRefusedUntyped() throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("page", "11"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").doesNotExist());
	}

	/** Zero is not a page either — the contract counts from one. */
	@Test
	void pageZeroIsRefusedUntyped() throws Exception {
		mockMvc.perform(get("/api/v1/businesses").param("zip", DENVER).param("page", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").doesNotExist());
	}

	private String search(String name, int page) throws Exception {
		return mockMvc.perform(get("/api/v1/businesses")
						.param("zip", DENVER)
						.param("name", name)
						.param("page", String.valueOf(page)))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
	}

	private List<String> slugsOn(String name, int page) throws Exception {
		return JsonPath.read(search(name, page), "$.results[*].slug");
	}

	/**
	 * Published businesses inserted with JDBC rather than driven through onboarding.
	 *
	 * <p>These tests are about arithmetic over rows, and the wizard has its own suite. What the
	 * search actually requires is what is set here: {@code PUBLISHED}, a point — the service area
	 * is generated from it and no area means no match — and a primary trade for the column the
	 * result carries. Working hours are left out, so the slots come back empty, which
	 * {@code BusinessSearchTests} already covers as its own case.
	 *
	 * <p>All of them at the same postal code, and therefore at the same point.
	 */
	private void givenPublishedBusinesses(String displayName, String slugPrefix, int count) {
		for (int index = 0; index < count; index++) {
			String slug = slugPrefix + "-" + index;
			UUID userId = UUID.randomUUID();
			UUID businessId = UUID.randomUUID();

			jdbcTemplate.update("""
					INSERT INTO identity_user (id, workos_user_id, email, created_at, updated_at, version)
					VALUES (?, ?, ?, now(), now(), 0)""",
					userId, "user_" + slug, slug + "@example.com");

			jdbcTemplate.update("""
					INSERT INTO business_profile (id, owner_user_id, slug, legal_name, display_name,
						phone, email, street1, city, state, postal_code, latitude, longitude,
						geocode_precision, time_zone, service_radius_miles, status,
						onboarding_completed_step, first_published_at, created_at, updated_at, version)
					SELECT ?, ?, ?, ?, ?, '+13035550101', 'dispatch@acme.example', '123 Main St',
						'Denver', 'CO', z.zip, z.latitude, z.longitude, 'ZIP', 'America/Denver', 25,
						'PUBLISHED', 9, now(), now(), now(), 0
					FROM zip_centroid z WHERE z.zip = ?""",
					businessId, userId, slug, displayName + " LLC", displayName, DENVER);

			jdbcTemplate.update("""
					INSERT INTO business_trade (business_id, trade_id, is_primary)
					SELECT ?, id, TRUE FROM trade WHERE code = 'PLUMBER'""", businessId);
		}
	}
}
