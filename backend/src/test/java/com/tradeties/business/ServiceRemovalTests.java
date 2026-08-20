package com.tradeties.business;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Removing a service, both ways out.
 *
 * <p>A service nothing points at is deleted. One an appointment names must not vanish — it
 * takes the history of every job that used it with it — so it is deactivated instead, and the
 * caller's intent is satisfied either way.
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

	@Test
	void aServiceNothingPointsAtIsDeleted() throws Exception {
		usage.answer(false);

		RequestPostProcessor token = businessFor("user_delete_unused", "delete-unused");
		String serviceId = createService(token, "Never booked");

		mockMvc.perform(delete("/api/v1/me/business/services/" + serviceId).with(token))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/business/services").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
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

	private String createService(RequestPostProcessor token, String name) throws Exception {
		String body = mockMvc.perform(post("/api/v1/me/business/services").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"%s","estimatedDurationMinutes":60,"pricingMode":"QUOTE_ONLY"}"""
								.formatted(name)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		return JsonPath.read(body, "$.id");
	}

	private RequestPostProcessor businessFor(String subject, String slug) throws Exception {
		return BusinessFixtures.businessFor(mockMvc, subject, slug);
	}
}
