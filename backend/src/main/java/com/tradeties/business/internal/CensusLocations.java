package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/**
 * The US Census Bureau's public geocoder, as a typed interface.
 *
 * <p>Only the shape of the call lives here. What to ask it and what to make of the answer is
 * {@link CensusGeocoder}'s, which is the one caller.
 */
@HttpExchange(url = "/geocoder/locations/address", accept = MediaType.APPLICATION_JSON_VALUE)
interface CensusLocations {

	/**
	 * @param benchmark which vintage of the address data answers. Passed rather than defaulted,
	 *        because the service picks one when it is omitted — and a default that moved would
	 *        move every point geocoded after it, with nothing in this codebase changing
	 */
	@GetExchange
	Locations locate(@RequestParam String street,
			@RequestParam String city,
			@RequestParam String state,
			@RequestParam String zip,
			@RequestParam String benchmark,
			@RequestParam String format);

	/**
	 * As much of the response as is read. Everything else it carries — the matched address, the
	 * parsed components, the TIGER line id — is left on the wire.
	 */
	record Locations(Result result) {

		/** No match is an empty list and a 200, not an error. An unroutable address is not a fault. */
		record Result(List<Match> addressMatches) {
		}

		record Match(Point coordinates) {
		}

		/**
		 * <strong>{@code x} is the longitude and {@code y} the latitude</strong>, which is the
		 * order a cartographer writes and the reverse of the order everyone says them in. Swapped,
		 * every US business lands in Antarctica or in the Indian Ocean, and the columns would take
		 * the values without complaint.
		 */
		record Point(BigDecimal x, BigDecimal y) {
		}
	}
}
