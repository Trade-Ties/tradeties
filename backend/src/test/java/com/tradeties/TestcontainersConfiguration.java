package com.tradeties;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicBoolean;

import org.flywaydb.core.Flyway;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
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
 *
 * <p>Two ways to get that PostgreSQL, the throwaway container being the default:
 *
 * <ul>
 * <li>{@code ./mvnw verify} — a container per run, started and dropped by Testcontainers.
 * Needs nothing running beforehand, which is why CI uses it.
 * <li>{@code ./mvnw verify -Pcompose-db} — the {@code tradeties_test} database inside the
 * Compose PostgreSQL from {@code infra/compose.yaml}, for anyone already running it for
 * their development data and not wanting a second container beside it.
 * </ul>
 *
 * <p>Either way the suite starts from an empty schema. It has to: {@link BusinessFixtures}
 * isolates tests by unique slugs and {@code workos_user_id}s and never cleans up, so a run
 * that inherited the previous run's rows would be answered 409 where it expects 201.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	/** The suffix {@link #emptyTheTestDatabaseOncePerRun} refuses to clean anything without. */
	private static final String TEST_DATABASE = "tradeties_test";

	/**
	 * Spring caches contexts and builds more than one of them across a suite, so the
	 * migration strategy below runs several times per JVM. Only the first may empty the
	 * database — a later one would wipe the rows the classes already finished had written.
	 */
	private static final AtomicBoolean FIRST_CONTEXT = new AtomicBoolean(true);

	/**
	 * Pinned, not {@code :latest} — a build should not change because upstream did.
	 *
	 * <p>PostGIS rather than plain postgres, and the same tag {@code infra/compose.yaml} carries.
	 * The search slice stores a service area as {@code geography} and indexes it, so a suite on
	 * the plain image would fail the migration that creates the extension — and the two must not
	 * be able to disagree about which database the code is written against.
	 *
	 * <p>It costs about 290 MB over {@code postgres:18-alpine} and a slower first pull. Every run
	 * after that is the same container start; the image is not rebuilt per run.
	 */
	@Bean
	@ServiceConnection
	@ConditionalOnProperty(name = "tradeties.test.compose-db", havingValue = "false", matchIfMissing = true)
	PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgis/postgis:18-3.6-alpine")
				.asCompatibleSubstituteFor("postgres"));
	}

	/**
	 * Drops and rebuilds the test schema once per run, since a shared database does not
	 * arrive empty the way a fresh container does.
	 *
	 * <p>Without a container supplying the connection, the datasource falls back to the
	 * default in {@code application.yml} — the {@code tradeties} development database. The
	 * URL check is what stops one missing system property from turning a test run into a
	 * silent {@code flyway clean} over the development data.
	 */
	@Bean
	@ConditionalOnProperty("tradeties.test.compose-db")
	FlywayMigrationStrategy emptyTheTestDatabaseOncePerRun() {
		return flyway -> {
			String url = connectionUrlOf(flyway);
			if (!url.endsWith(TEST_DATABASE)) {
				throw new IllegalStateException("The suite is configured to clean its database, but points at "
						+ url + " rather than a database named " + TEST_DATABASE
						+ ". Refusing to run rather than emptying the wrong one.");
			}
			if (FIRST_CONTEXT.compareAndSet(true, false)) {
				flyway.clean();
			}
			flyway.migrate();
		};
	}

	/**
	 * Out of a live connection, not out of {@code getConfiguration().getUrl()}: Spring Boot
	 * hands Flyway a configured DataSource and leaves that field null, so reading it would
	 * make the check above pass for any database at all.
	 */
	private static String connectionUrlOf(Flyway flyway) {
		try (Connection connection = flyway.getConfiguration().getDataSource().getConnection()) {
			return connection.getMetaData().getURL();
		}
		catch (SQLException ex) {
			throw new IllegalStateException("Cannot read the URL of the database the suite is about to clean.", ex);
		}
	}

}
