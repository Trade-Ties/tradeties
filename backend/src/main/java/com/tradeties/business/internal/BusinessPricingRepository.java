package com.tradeties.business.internal;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface BusinessPricingRepository extends JpaRepository<BusinessPricing, UUID> {
}
