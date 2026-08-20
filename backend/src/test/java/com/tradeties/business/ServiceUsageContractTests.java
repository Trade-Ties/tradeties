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
 * Keeps {@code NoServiceReferencesYet} honest.
 *
 * <p>That bean answers "nothing references a service", and it is right — today. What makes it
 * right is a property of the schema, not an opinion, so the schema is asked rather than
 * trusted. The day a foreign key onto {@code business_service} lands, this fails and names the
 * table that did it.
 *
 * <p>Without this the bean would quietly go stale: removal would take the delete branch for a
 * service an appointment names, the constraint would refuse it, and the failure would surface
 * as a 500 somewhere far from the change that caused it.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ServiceUsageContractTests {

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	void noForeignKeyPointsAtAServiceYet() {
		List<String> referencing = jdbcTemplate.queryForList("""
				SELECT child.relname || '.' || c.conname
				FROM pg_constraint c
				JOIN pg_class parent ON parent.oid = c.confrelid
				JOIN pg_class child ON child.oid = c.conrelid
				WHERE c.contype = 'f'
				  AND parent.relname = 'business_service'
				ORDER BY 1""", String.class);

		assertEquals(List.of(), referencing, """
				Something now has a foreign key onto business_service, so NoServiceReferencesYet \
				is answering a question it can no longer answer. Removing a service that this \
				table points at would take the delete branch and be refused by the constraint. \
				Replace the bean with a real ServiceUsage in the module that owns the new table, \
				and delete NoServiceReferencesYet — two beans of one interface will stop the \
				application from starting until you do.""");
	}
}
