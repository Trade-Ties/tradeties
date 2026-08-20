package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.UUID;

import com.tradeties.BusinessFixtures;
import com.tradeties.TestcontainersConfiguration;
import com.tradeties.business.MaterialPricingMode;
import com.tradeties.business.PricingDefinition;
import com.tradeties.business.TravelFeeMode;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The first write of a business's rates has to be an insert.
 *
 * <p>This sits in {@code internal} rather than going through the API for the reason
 * {@code PolicyProvisioningTests} gives: the behaviour under test is what happens when two
 * first writes meet, and over HTTP that window is a few statements wide and cannot be hit on
 * purpose. What the race leaves behind can be reproduced exactly, and that is what is checked.
 *
 * <p>Its subject is the difference between {@code persist} and {@code save}. With an assigned
 * id — the business's own — and a primitive {@code @Version}, Spring Data reads the entity as
 * not-new, so {@code save} is a {@code merge}: a select, and then an <em>update</em> if the row
 * turned up in the meantime. The loser of the race would overwrite the winner's committed rates
 * and answer 200 to a client that was owed a 409. Money, written by the wrong request, with
 * nothing anywhere saying it happened.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class PricingInsertTests {

	@Autowired
	PricingInsert insert;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	TransactionTemplate transactions;

	@Test
	void aFirstInsertStoresTheRates() {
		UUID businessId = givenABusiness("pricing-first", "user_pricing_insert_first");

		insertRates(businessId, new BigDecimal("95.00"));

		assertEquals(1, pricingRowsFor(businessId, new BigDecimal("95.00")));
	}

	/**
	 * The assertion the whole change rests on. A {@code merge} would have returned quietly and
	 * left the winner's hourly rate replaced by the loser's; an insert is refused by the primary
	 * key, which is what lets {@code PricingService} answer 409 instead of 200.
	 */
	@Test
	void insertingOverStoredRatesDoesNotOverwriteThem() {
		UUID businessId = givenABusiness("pricing-taken", "user_pricing_insert_taken");
		insertRates(businessId, new BigDecimal("95.00"));

		assertThrows(DataIntegrityViolationException.class,
				() -> insertRates(businessId, new BigDecimal("300.00")),
				"a second insert of the same business must be refused by the primary key");

		BigDecimal stored = jdbc.queryForObject(
				"SELECT hourly_rate FROM business_pricing WHERE business_id = ?",
				BigDecimal.class, businessId);

		assertEquals(0, stored.compareTo(new BigDecimal("95.00")), "the winner's rate is untouched");
	}

	@Test
	void aLostInsertLeavesTheNextBusinessWritable() {
		UUID taken = givenABusiness("pricing-lost", "user_pricing_insert_lost");
		insertRates(taken, new BigDecimal("95.00"));

		assertThrows(DataIntegrityViolationException.class, () -> insertRates(taken, new BigDecimal("300.00")));

		UUID next = givenABusiness("pricing-next", "user_pricing_insert_next");
		insertRates(next, new BigDecimal("120.00"));

		assertEquals(1, pricingRowsFor(next, new BigDecimal("120.00")));
	}

	/**
	 * Through a {@link TransactionTemplate} because the insert is {@code MANDATORY}: it joins
	 * the caller's transaction on purpose, so that a violation takes the caller down with it
	 * rather than letting an onboarding step advance over rates that were never written.
	 */
	private void insertRates(UUID businessId, BigDecimal hourlyRate) {
		transactions.executeWithoutResult(status -> insert.insert(new BusinessPricing(businessId, rates(hourlyRate))));
	}

	private static PricingDefinition rates(BigDecimal hourlyRate) {
		return new PricingDefinition(
				hourlyRate, 60, 15,
				null, false,
				TravelFeeMode.INCLUDED, null, null, null,
				MaterialPricingMode.INCLUDED, null,
				new BigDecimal("50.00"), 24);
	}

	private int pricingRowsFor(UUID businessId, BigDecimal hourlyRate) {
		return jdbc.queryForObject(
				"SELECT count(*) FROM business_pricing WHERE business_id = ? AND hourly_rate = ?",
				Integer.class, businessId, hourlyRate);
	}

	private UUID givenABusiness(String slug, String subject) {
		return BusinessFixtures.givenABusiness(jdbc, slug, subject);
	}
}
