package com.tradeties.business.internal;

import java.util.Collection;

import com.tradeties.business.ServiceUsage;

import org.springframework.stereotype.Component;

/**
 * The one rule for taking a service off the books, wherever the removal comes from.
 *
 * <p>A service an appointment names is deactivated, because the row is the only record of what
 * that job was; anything else is stamped removed. Two paths reach it: the catalogue's own delete,
 * and a trade being given up, which takes the services filed under it with it.
 *
 * <p><strong>The question is asked, not attempted.</strong> Trying the delete and catching the
 * foreign key violation cannot work: PostgreSQL aborts the entire transaction on a failed
 * statement, so the fallback would run where not even a bare {@code SELECT 1} is permitted
 * ({@code SQLSTATE 25P02}).
 *
 * <p>Rows must arrive here already locked — see
 * {@link ServiceOfferingRepository#lockByIdAndBusinessId}, which says why the answer would
 * otherwise go stale between the question and the act. Nothing is flushed here: when that has to
 * happen depends on what the caller reads next, so it stays the caller's to decide.
 */
@Component
class ServiceRemoval {

	private final ServiceOfferingRepository services;
	private final ServiceUsage usage;

	ServiceRemoval(ServiceOfferingRepository services, ServiceUsage usage) {
		this.services = services;
		this.usage = usage;
	}

	void removeAll(Collection<ServiceOffering> offerings) {
		for (ServiceOffering service : offerings) {
			if (usage.isReferenced(service.id())) {
				service.deactivate();
				services.save(service);
			}
			else {
				services.delete(service);
			}
		}
	}
}
