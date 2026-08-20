package com.tradeties.business;

/**
 * Compared case-insensitively, because "Clog removal" and "CLOG REMOVAL" are the same
 * entry to everyone except a byte comparison — which is exactly what the unique index on
 * {@code lower(name)} says.
 */
public class ServiceNameTakenException extends RuntimeException {

	public ServiceNameTakenException(String name) {
		super("A service called '" + name + "' already exists");
	}
}
