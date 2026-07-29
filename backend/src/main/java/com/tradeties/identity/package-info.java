/**
 * Identity — who is calling, and what are they allowed to be in this marketplace.
 *
 * <p>Authentication itself is outsourced to WorkOS AuthKit. This module owns the
 * <em>local projection</em> of that identity: a TradeTies user row keyed by the WorkOS
 * user id, plus the marketplace roles ({@code CUSTOMER}, {@code BUSINESS_OWNER}, …).
 *
 * <p>The projection matters — never foreign-key domain data straight to an external
 * provider's id. Every other module references the local user id, so the identity
 * provider stays replaceable.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Identity")
package com.tradeties.identity;
