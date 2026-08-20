package com.tradeties.business;

public class BusinessAlreadyExistsException extends RuntimeException {

	public BusinessAlreadyExistsException() {
		super("This account already has a business");
	}
}
