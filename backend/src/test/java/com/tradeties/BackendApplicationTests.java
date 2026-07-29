package com.tradeties;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Skeleton smoke test: the application context starts against real PostgreSQL, Flyway
 * migrates, Hibernate validates the resulting schema, and the contract-first endpoint is
 * wired up and protected. If this is green, the scaffolding holds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BackendApplicationTests {

	@Autowired
	MockMvc mockMvc;

	@Test
	void contextLoads() {
		// Intentionally empty: the assertion is that Flyway ran and ddl-auto=validate
		// found the schema consistent. Both happen during context startup.
	}

	@Test
	void currentUserEndpointRejectsAnonymousCallers() throws Exception {
		mockMvc.perform(get("/api/v1/me"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void currentUserEndpointReturnsThePrincipalFromTheToken() throws Exception {
		mockMvc.perform(get("/api/v1/me")
						.with(jwt().jwt(token -> token
								.subject("user_01HQ8Z3K9M2P4R6T8V0X2Y4A6C")
								.claim("email", "dana@example.com"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.userId").value("user_01HQ8Z3K9M2P4R6T8V0X2Y4A6C"))
				.andExpect(jsonPath("$.email").value("dana@example.com"))
				.andExpect(jsonPath("$.roles").isArray());
	}

	@Test
	void healthProbeIsPubliclyReachable() throws Exception {
		mockMvc.perform(get("/actuator/health"))
				.andExpect(status().isOk());
	}
}
