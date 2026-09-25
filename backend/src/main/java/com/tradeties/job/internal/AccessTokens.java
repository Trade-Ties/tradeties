package com.tradeties.job.internal;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;

/**
 * The credential a customer with no account gets instead of a session.
 *
 * <p><strong>Issued once and stored only as a digest.</strong> The clear value exists in the
 * response to the request that created the job and nowhere else, which is the difference between
 * a credential and a row anybody with database access can use.
 *
 * <p>No salt and no password hash. Both answer a threat this value does not have: a token is 256
 * bits from a cryptographic source, so there is no dictionary to try and nothing for a slow hash
 * to slow down. SHA-256 over a high-entropy secret is the right instrument, and the lookup has to
 * be an indexed equality — a per-row salt would make it a table scan.
 */
final class AccessTokens {

	/**
	 * Long enough that guessing is not a strategy, and the only property that matters here.
	 * Base64url of 32 bytes is 43 characters, which still fits in a link somebody can be sent.
	 */
	private static final int BYTES = 32;

	/**
	 * How long the way back stays open.
	 *
	 * <p>Three months, which outlives an appointment and the argument about it afterwards without
	 * leaving a live credential in an old mailbox forever. Nothing in the data model asks for a
	 * particular figure; the column only insists there be one.
	 */
	static final Duration LIFETIME = Duration.ofDays(90);

	private static final SecureRandom RANDOM = new SecureRandom();

	private AccessTokens() {
	}

	static String issue() {
		byte[] bytes = new byte[BYTES];
		RANDOM.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	/** Hex rather than Base64, because the column is 64 characters and that is what SHA-256 is. */
	static String digest(String token) {
		try {
			MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(sha256.digest(token.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException impossible) {
			// Every JVM ships SHA-256; the checked exception is an artefact of the 1.4 API.
			throw new IllegalStateException("SHA-256 is missing from this JVM", impossible);
		}
	}
}
