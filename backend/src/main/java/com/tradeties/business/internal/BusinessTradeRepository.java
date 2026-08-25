package com.tradeties.business.internal;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@code deleted_at} is named by each method that means it rather than filtered globally — see
 * {@link BusinessTradeLink} for why this table cannot use {@code @SoftDelete}.
 *
 * <p>Three of the four do. The fourth deliberately sees retired rows, and its name cannot say so:
 * Spring Data derives the query from the name and has no keyword for including them. Its javadoc
 * carries that instead.
 */
interface BusinessTradeRepository extends JpaRepository<BusinessTradeLink, BusinessTradeLinkId> {

	List<BusinessTradeLink> findByIdBusinessIdAndDeletedAtIsNull(UUID businessId);

	/**
	 * Every link this business has ever had, retired ones included — which is what
	 * {@code TradeSelectionService} needs to revive a trade being re-ticked instead of
	 * inserting a second row over the same primary key.
	 */
	List<BusinessTradeLink> findByIdBusinessId(UUID businessId);

	boolean existsByIdBusinessIdAndIdTradeIdAndDeletedAtIsNull(UUID businessId, UUID tradeId);

	/**
	 * The partial unique index guarantees this is 0 or 1. Publishing needs it to be exactly
	 * 1, which no index can say.
	 */
	long countByIdBusinessIdAndPrimaryIsTrueAndDeletedAtIsNull(UUID businessId);
}
