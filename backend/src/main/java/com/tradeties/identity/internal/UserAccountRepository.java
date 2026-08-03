package com.tradeties.identity.internal;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Package-private like the entity it stores: the repository is machinery of this module,
 * not part of what it offers other modules.
 */
interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

	Optional<UserAccount> findByWorkosUserId(String workosUserId);
}