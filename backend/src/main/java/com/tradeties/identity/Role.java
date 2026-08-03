package com.tradeties.identity;

/**
 * A marketplace role, as TradeTies defines it — not as WorkOS does.
 *
 * <p>Deliberately a second enum next to the generated {@code MarketplaceRole}. That one is
 * the shape of the wire and is regenerated from {@code api/openapi.yaml} into
 * {@code target/}; this one is the domain concept other modules reference, and it is what
 * gets persisted. Letting a generated type own the database schema would mean a contract
 * edit could silently reinterpret stored rows.
 *
 * <p>The two are mapped by name, and {@code RoleContractTest} fails the build if they ever
 * drift apart.
 *
 * <p>Roles are <em>additive</em>. Owner and member describe a position inside a business;
 * {@code PLATFORM_ADMIN} stands beside that, and {@code CUSTOMER} is orthogonal to all of
 * them — a tradesperson may book work too (DECISIONS section 2).
 */
public enum Role {

	/**
	 * Books work: sends requests, withdraws them, sees their own jobs.
	 *
	 * <p>Unused for now — customers use TradeTies anonymously and need no account. Becomes
	 * relevant when the demand side gets optional accounts.
	 */
	CUSTOMER,

	/**
	 * Registered a business and owns its profile, calendar, cancellation fee and — later —
	 * its staff. The only role this slice grants.
	 */
	BUSINESS_OWNER,

	/**
	 * Works for a business someone else owns: may accept or decline requests on its behalf,
	 * but not change the company profile or its fees.
	 *
	 * <p>Arrives by invitation, never by self-registration. This is also where WorkOS
	 * Organizations and SSO attach later (DECISIONS section 7).
	 */
	BUSINESS_MEMBER,

	/** TradeTies staff: support and moderation. Never granted through a public endpoint. */
	PLATFORM_ADMIN
}
