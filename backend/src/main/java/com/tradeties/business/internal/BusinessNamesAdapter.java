package com.tradeties.business.internal;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.tradeties.business.BusinessDetails;
import com.tradeties.business.BusinessNames;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class BusinessNamesAdapter implements BusinessNames {

	private final BusinessProfileRepository businesses;

	BusinessNamesAdapter(BusinessProfileRepository businesses) {
		this.businesses = businesses;
	}

	@Override
	@Transactional(readOnly = true)
	public Map<UUID, BusinessName> byIds(Collection<UUID> businessIds) {
		return businesses.findAllById(businessIds).stream()
				.collect(Collectors.toMap(BusinessProfile::id, profile -> {
					BusinessDetails details = profile.toDetails();
					return new BusinessName(details.slug(), details.displayName(), details.email());
				}));
	}
}
