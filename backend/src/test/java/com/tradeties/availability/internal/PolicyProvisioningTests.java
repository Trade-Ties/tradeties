package com.tradeties.availability.internal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;

import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;
import com.tradeties.availability.BookingRules;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The booking policy row is the mutex of the whole calendar, so it has to exist before any
 * calendar write — and two first writes can arrive at once.
 *
 * <p>This sits in {@code internal} rather than going through the API because the interesting
 * behaviour is a transaction boundary, and that is not observable over HTTP: the race produces
 * a 500 either way, and only the reason differs.
 *
 * <p>The row's starting version belongs here for the same reason. What {@code GET} promises
 * before the row exists is only right as long as it matches what provisioning then writes, and
 * nothing but this file connects the two.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class PolicyProvisioningTests {

	@Autowired
	PolicyProvisioning provisioning;

	@Autowired
	PolicyInsert insert;

	@Autowired
	JdbcTemplate jdbc;

	@Test
	void aFirstCallProvisionsTheRow() {
		UUID businessId = givenABusiness("prov-first", "user_prov_first");

		assertEquals(0, policyRowsFor(businessId));

		provisioning.ensureExists(businessId);

		assertEquals(1, policyRowsFor(businessId));
	}

	@Test
	void aSecondCallChangesNothing() {
		UUID businessId = givenABusiness("prov-second", "user_prov_second");

		provisioning.ensureExists(businessId);
		provisioning.ensureExists(businessId);

		assertEquals(1, policyRowsFor(businessId));
	}

	/**
	 * {@code GET /booking-policy} never answers 404: before the row exists it serves
	 * {@link BookingRules#defaults()}, version and all, because those are exactly the values
	 * provisioning would write. The client then sends that version back on its first
	 * {@code PUT}, and the row it meets has to be at the same one.
	 *
	 * <p>Nothing in the code links them. One is a literal in {@code BookingRules.defaults()},
	 * the other is whatever Hibernate stamps on a new entity. They agree today, at 0, and this
	 * test is the only thing that says they must.
	 *
	 * <p>The day they stop agreeing, every business's first write to its booking rules answers
	 * 409 — "the rules changed since you loaded them", about rules nobody had touched — and
	 * reloading hands the client the same wrong number again. A failure with no bad write
	 * behind it and no way out is worth a test that cannot be argued with.
	 */
	@Test
	void aProvisionedRowIsAtTheVersionTheDefaultsPromise() {
		UUID businessId = givenABusiness("prov-version", "user_prov_version");

		provisioning.ensureExists(businessId);

		long provisioned = jdbc.queryForObject(
				"SELECT version FROM availability_booking_policy WHERE business_id = ?",
				Long.class, businessId);

		assertEquals(BookingRules.defaults().version(), provisioned,
				"GET serves this version before the row exists, so provisioning must produce it");
	}

	/**
	 * A losing insert has to roll back <em>on its own</em> and leave the caller able to carry
	 * on. Previously the insert ran in the caller's own transaction, so the violation marked that
	 * transaction rollback-only and the commit afterwards threw
	 * {@code UnexpectedRollbackException} — the caller could not finish even though the outcome
	 * it wanted, a provisioned row, had been achieved by somebody else.
	 *
	 * <p>The race itself needs two threads meeting in a window a few statements wide, which no
	 * test can hit reliably. What it leaves behind can be reproduced exactly, and that is what
	 * is checked here: a failed insert, and then a caller that still works.
	 */
	@Test
	void aLostInsertRollsBackAloneAndLeavesTheCallerWorking() {
		UUID taken = givenABusiness("prov-taken", "user_prov_taken");
		insert.insert(taken);

		assertThrows(DataIntegrityViolationException.class, () -> insert.insert(taken),
				"a second insert of the same business must be refused by the primary key");

		assertEquals(1, policyRowsFor(taken), "the winner's row is untouched");

		UUID next = givenABusiness("prov-next", "user_prov_next");
		assertDoesNotThrow(() -> provisioning.ensureExists(next),
				"the failed insert must not have poisoned anything the caller goes on to do");

		assertEquals(1, policyRowsFor(next));
	}

	/**
	 * {@code persist}, not {@code save}. With an assigned id and a primitive version Spring Data
	 * reads the row as not-new, so {@code save} would be a {@code merge} — and a merge on a row
	 * that turned up in the meantime is an <em>update</em>, quietly overwriting a policy the
	 * winner may already have configured. The assertion above that this throws is what pins that
	 * down: a merge would have returned quietly instead.
	 */
	@Test
	void insertingOverAConfiguredPolicyDoesNotOverwriteIt() {
		UUID businessId = givenABusiness("prov-configured", "user_prov_configured");
		insert.insert(businessId);

		jdbc.update("UPDATE availability_booking_policy SET booking_horizon_days = 90 WHERE business_id = ?",
				businessId);

		assertThrows(DataIntegrityViolationException.class, () -> insert.insert(businessId));

		assertEquals(90, jdbc.queryForObject(
				"SELECT booking_horizon_days FROM availability_booking_policy WHERE business_id = ?",
				Integer.class, businessId));
	}

	/**
	 * Dropping a {@code DataIntegrityViolationException} is only defensible while the row it
	 * was about exists afterwards. The foreign key raises the same type when there is no profile
	 * to hang the policy on — and swallowed, that leaves the caller to fail further along on
	 * "provisioning did not run", which describes the symptom and points away from the cause.
	 *
	 * <p>A business id nobody ever created is the same condition as a profile deleted mid-flight,
	 * and it can be arranged exactly.
	 */
	@Test
	void aViolationThatIsNotTheInsertRaceIsNotSwallowed() {
		UUID neverExisted = UUID.randomUUID();

		assertThrows(DataIntegrityViolationException.class, () -> provisioning.ensureExists(neverExisted),
				"there is no row afterwards, so this was not the race the catch is written for");
	}

	private int policyRowsFor(UUID businessId) {
		return jdbc.queryForObject(
				"SELECT count(*) FROM availability_booking_policy WHERE business_id = ?",
				Integer.class, businessId);
	}

	private UUID givenABusiness(String slug, String subject) {
		return BusinessFixtures.givenABusiness(jdbc, slug, subject);
	}
}
