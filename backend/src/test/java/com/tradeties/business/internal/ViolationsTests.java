package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.UUID;

import com.tradeties.TestcontainersConfiguration;
import com.tradeties.business.BusinessInput;
import com.tradeties.business.PostalAddress;
import com.tradeties.business.ServiceDefinition;
import com.tradeties.business.ServicePricingMode;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Reading a rejected write instead of guessing about it.
 *
 * <p>Below the API on purpose. What is worth testing here is which constraint the database
 * broke, and over HTTP that is unreachable: the pre-checks in the services answer first, and
 * the only way past them is a race no test can schedule. Going at the repositories directly
 * produces the same violation the race would, on demand.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ViolationsTests {

	@Autowired
	BusinessProfileRepository profiles;

	@Autowired
	ServiceOfferingRepository services;

	@Autowired
	JdbcTemplate jdbc;

	/**
	 * The names now live in two files — the migration that creates each index and
	 * {@link Violations} that reads it back — and nothing but this test connects them. A rename
	 * in a later migration compiles, deploys, and quietly stops matching; the careful message
	 * turns back into the 500 the whole exercise was about.
	 */
	@Test
	void everyNameTheCodeReadsIsAnIndexThatExists() {
		for (String name : Violations.ALL) {
			Integer found = jdbc.queryForObject(
					"SELECT count(*) FROM pg_indexes WHERE indexname = ?", Integer.class, name);

			assertTrue(found != null && found == 1,
					name + " is read in Violations but no index of that name exists — a rename in a "
							+ "migration would silently turn the translation back into a 500");
		}
	}

	/**
	 * The double-click on "create business", reproduced without the race.
	 *
	 * <p>Two requests from one caller both find no business and both insert; the loser breaks
	 * the owner index, not the slug index. Reported as a taken slug — which is what happened
	 * before this — the client goes looking for another name, and every other name fails
	 * identically, because the name was never the problem.
	 */
	@Test
	void aSecondBusinessForOneOwnerIsTheOwnerIndexAndNotTheSlug() {
		UUID ownerUserId = givenAUser("user_violations_owner");
		profiles.saveAndFlush(new BusinessProfile(ownerUserId, input("violations-first"), null));

		DataIntegrityViolationException refused = assertThrows(DataIntegrityViolationException.class,
				() -> profiles.saveAndFlush(new BusinessProfile(ownerUserId, input("violations-second"), null)));

		assertTrue(Violations.broke(refused, Violations.BUSINESS_BY_OWNER),
				"one account, one business — this is the index that refused it");
		assertFalse(Violations.broke(refused, Violations.BUSINESS_BY_SLUG),
				"the slug was free, and saying otherwise sends the client after a name that will "
						+ "fail just the same");
	}

	/**
	 * An amount too wide for {@code NUMERIC(19,4)} is refused by PostgreSQL as a data error
	 * rather than a constraint, so it carries no constraint name at all. It must therefore match
	 * nothing here and be rethrown — a 500 that gets looked at — rather than come back as the
	 * duplicate name it is not. The contract's own pattern stops this one at the edge now; the
	 * next unhandled violation will not have that luxury.
	 */
	@Test
	void aFailureThatIsNoConstraintAtAllMatchesNothing() {
		UUID ownerUserId = givenAUser("user_violations_wide");
		UUID businessId = profiles.saveAndFlush(new BusinessProfile(ownerUserId, input("violations-wide"), null)).id();

		ServiceDefinition tooWide = new ServiceDefinition(null, "Huge", null, 60,
				ServicePricingMode.FLAT, new BigDecimal("99999999999999999999"), true);

		DataIntegrityViolationException refused = assertThrows(DataIntegrityViolationException.class,
				() -> services.saveAndFlush(new ServiceOffering(businessId, tooWide, 10)));

		assertFalse(Violations.broke(refused, Violations.SERVICE_BY_NAME),
				"the name was free; only the number was impossible");
	}

	private UUID givenAUser(String workosUserId) {
		UUID userId = UUID.randomUUID();
		jdbc.update("""
				INSERT INTO identity_user (id, workos_user_id, email, created_at, updated_at, version)
				VALUES (?, ?, 'violations@example.com', now(), now(), 0)""", userId, workosUserId);

		return userId;
	}

	private static BusinessInput input(String slug) {
		return new BusinessInput(
				slug,
				"Acme Plumbing LLC",
				"Acme Plumbing",
				null,
				null,
				"+13035550101",
				"dispatch@acme.example",
				new PostalAddress("123 Main St", null, "Denver", "CO", "80202"),
				null,
				"America/Denver",
				25);
	}
}
