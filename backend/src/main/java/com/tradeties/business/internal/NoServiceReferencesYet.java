package com.tradeties.business.internal;

import java.util.UUID;

import com.tradeties.business.ServiceUsage;

import org.springframework.stereotype.Component;

/**
 * The true answer today: no table in the schema has a foreign key onto
 * {@code business_service}, so nothing can be referencing a service. Not a stub —
 * {@code ServiceUsageContractTests} asks PostgreSQL directly and fails the build the day that
 * stops being true.
 *
 * <p><strong>This class is meant to be deleted.</strong> When {@code job} arrives with
 * {@code job_request.service_id} it brings the real implementation, and two beans of one interface
 * stop the application from starting — in the pull request that introduces the reference, which is
 * exactly when somebody has to decide what the right answer is.
 */
@Component
class NoServiceReferencesYet implements ServiceUsage {

	@Override
	public boolean isReferenced(UUID serviceId) {
		return false;
	}
}
