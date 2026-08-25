package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Removing a service, both ways out.
 *
 * <p>A service nothing points at is removed from the catalogue. One an appointment names must
 * stay visible — it takes the history of every job that used it with it — so it is deactivated
 * instead, listed with {@code active: false}, and the caller's intent is satisfied either way.
 *
 * <p>Neither path destroys the row. Removal stamps {@code deleted_at} and the service drops out
 * of every read; deactivation leaves it in the list saying so. The two are different answers to
 * "can somebody still see this", not to "does it still exist".
 *
 * <p><strong>The second path is why this class exists.</strong> "Try the delete, catch the
 * foreign key violation, deactivate instead" cannot work — PostgreSQL aborts the whole
 * transaction on a failed statement — and it is unreachable today, because {@code job_request}
 * does not exist yet. Asking {@link ServiceUsage} instead of attempting makes it correct, and
 * overriding the answer here makes it reachable.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ServiceRemovalTests {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	SettableServiceUsage usage;

	@Autowired
	JdbcTemplate jdbc;

	@Test
	void aServiceNothingPointsAtLeavesTheCatalogue() throws Exception {
		usage.answer(false);

		RequestPostProcessor token = businessFor("user_delete_unused", "delete-unused");
		String serviceId = createService(token, "Never booked");

		mockMvc.perform(delete("/api/v1/me/business/services/" + serviceId).with(token))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));

		// Gone from the answer above, still in the table. Asked of PostgreSQL directly, because
		// every read path through the application is filtered and cannot tell the two apart.
		assertEquals(1, jdbc.queryForObject("""
				SELECT count(*) FROM business_service WHERE id = ?::uuid AND deleted_at IS NOT NULL""",
				Integer.class, serviceId),
				"removal destroyed the row instead of stamping it");
	}

	/**
	 * Asserting that it is still listed is the point: gone and retired are different outcomes, and
	 * only one of them keeps the appointments that name it readable.
	 */
	@Test
	void aServiceSomethingPointsAtIsDeactivatedInstead() throws Exception {
		usage.answer(true);

		RequestPostProcessor token = businessFor("user_delete_booked", "delete-booked");
		String serviceId = createService(token, "Already booked");

		mockMvc.perform(delete("/api/v1/me/business/services/" + serviceId).with(token))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].id").value(serviceId))
				.andExpect(jsonPath("$[0].active").value(false));
	}

	/**
	 * The same question on the other path that removes services.
	 *
	 * <p>Giving up a trade retires everything filed under it, and it owes the same rule: an
	 * appointment's history must not depend on which screen the removal was made from.
	 */
	@Test
	void aServiceSomethingPointsAtSurvivesItsTradeBeingGivenUp() throws Exception {
		usage.answer(true);

		RequestPostProcessor token = businessFor("user_trade_gone_booked", "trade-gone-booked");
		String serviceId = createService(token, "Already booked");

		mockMvc.perform(put("/api/v1/me/business/trades").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"primaryTradeId":"%s","additionalTradeIds":[]}"""
								.formatted(BusinessFixtures.tradeId(mockMvc, "ROOFER"))))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].id").value(serviceId))
				.andExpect(jsonPath("$[0].active").value(false));
	}

	@Test
	void aStrangersServiceIsNotFoundBeforeTheQuestionIsEvenAsked() throws Exception {
		usage.answer(true);

		RequestPostProcessor owner = businessFor("user_removal_owner", "removal-owner");
		String serviceId = createService(owner, "Private");

		RequestPostProcessor stranger = businessFor("user_removal_stranger", "removal-stranger");

		mockMvc.perform(delete("/api/v1/me/business/services/" + serviceId).with(stranger))
				.andExpect(status().isNotFound());

		mockMvc.perform(get("/api/v1/me/business/services").with(owner))
				.andExpect(jsonPath("$.length()").value(1));
	}

	/**
	 * Deliberately hand-written rather than a mocking framework.
	 *
	 * <p>Nothing else in this test suite mocks, and Mockito's default mock maker needs to attach
	 * an agent to the running VM — which this JDK refuses often enough that the test passed on
	 * one run and failed to start the context on the next. A test that is only sometimes green
	 * is worse than no test, and the whole behaviour needed here is one settable boolean.
	 */
	static class SettableServiceUsage implements ServiceUsage {

		private boolean referenced;

		void answer(boolean referenced) {
			this.referenced = referenced;
		}

		@Override
		public boolean isReferenced(UUID serviceId) {
			return referenced;
		}
	}

	/**
	 * Takes precedence over {@code NoServiceReferencesYet}, which answers the truth for the
	 * current schema and therefore cannot exercise the other branch.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	static class StandInForJob {

		@Bean
		@Primary
		SettableServiceUsage settableServiceUsage() {
			return new SettableServiceUsage();
		}
	}

	/** Claims a trade first: a service requires one, and none of these tests is about which. */
	private String createService(RequestPostProcessor token, String name) throws Exception {
		return BusinessFixtures.givenAService(mockMvc, token, name);
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
