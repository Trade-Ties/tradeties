package com.tradeties;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The database for tests and for local development.
 *
 * <p>Tests run against real PostgreSQL, never H2 — Flyway migrations, {@code timestamptz}
 * behaviour and constraint semantics are exactly the things an in-memory stand-in gets
 * wrong, and they are the things worth testing.
 *
 * <p>Also drives local development via {@code ./mvnw spring-boot:test-run}, so there is
 * no second database configuration that can drift from this one.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	/** Pinned, not {@code :latest} — a build should not change because upstream did. */
	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));
	}

}
