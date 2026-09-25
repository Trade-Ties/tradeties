package com.tradeties.business;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Keeps {@link ServiceUsage} honest about which tables it speaks for.
 *
 * <p>It used to guard the opposite claim. Until {@code job} landed, nothing in the schema
 * referenced {@code business_service} and a bean said so; this test asked PostgreSQL rather than
 * trusting the bean, and failed the day that stopped being true — which is how the implementation
 * came to be written in the same change as the table.
 *
 * <p>Now it guards the list. {@code RequestedServices} answers for {@code job_request} and for
 * nothing else, so a second referencing table means a second thing that can hold a service — and
 * an implementation that still looks at one of them would let a tradesperson remove a service the
 * new table names, quietly taking the record of it away from whoever could still read it.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ServiceUsageContractTests {

	/**
	 * The tables {@code ServiceUsage} is known to speak for. Adding one here is a claim that its
	 * implementation was extended to ask about it.
	 */
	private static final List<String> ANSWERED_FOR =
			List.of("job_request.job_request_business_id_service_id_fkey");

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	void everyForeignKeyOntoAServiceIsOneServiceUsageAnswersFor() {
		List<String> referencing = jdbcTemplate.queryForList("""
				SELECT child.relname || '.' || c.conname
				FROM pg_constraint c
				JOIN pg_class parent ON parent.oid = c.confrelid
				JOIN pg_class child ON child.oid = c.conrelid
				WHERE c.contype = 'f'
				  AND parent.relname = 'business_service'
				ORDER BY 1""", String.class);

		assertEquals(ANSWERED_FOR, referencing, """
				A table now references business_service that ServiceUsage does not ask about. \
				Removing a service that table names would take the delete branch and disappear \
				from the profile, taking the only readable record of what was asked for with it. \
				Extend the ServiceUsage implementation to cover the new table, then add its \
				constraint to ANSWERED_FOR.""");
	}
}
