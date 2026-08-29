package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.math.BigDecimal;

import com.tradeties.business.GeoPoint;
import com.tradeties.business.PostalAddress;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/**
 * The Census client, against a stand-in for the service.
 *
 * <p>Never against the real one. A suite that reached the internet would be slow, would fail on a
 * train, and would put a few hundred requests a day onto somebody's free public service — and the
 * thing worth testing is not that the Census can geocode, it is that this code reads the answer
 * the right way round.
 *
 * <p>No Spring context either: the collaborator is one interface, so the whole thing assembles in
 * four lines and runs in milliseconds. That the bean can actually be built is proved by every
 * {@code @SpringBootTest} in the suite starting.
 */
class CensusGeocoderTests {

	private static final PostalAddress DENVER =
			new PostalAddress("1600 Broadway", null, "Denver", "CO", "80202");

	private MockRestServiceServer census;
	private CensusGeocoder geocoder;

	@BeforeEach
	void bindToAStandIn() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://census.invalid");
		census = MockRestServiceServer.bindTo(builder).build();

		geocoder = new CensusGeocoder(HttpServiceProxyFactory
				.builderFor(RestClientAdapter.create(builder.build()))
				.build()
				.createClient(CensusLocations.class));
	}

	/**
	 * The one that matters. The service answers {@code x} first and it is the <em>longitude</em>;
	 * read in the order the pair is spoken, a Denver business lands in the Indian Ocean and the
	 * columns accept it without complaint.
	 */
	@Test
	void theAnswerIsReadLongitudeFirst() {
		census.expect(requestTo(Matchers.containsString("/geocoder/locations/address")))
				.andRespond(withSuccess(matchAt("-104.987336378379", "39.742007876168"),
						MediaType.APPLICATION_JSON));

		GeoPoint point = located(geocoder.locate(DENVER)).point();

		assertEquals(0, new BigDecimal("39.742008").compareTo(point.latitude()), "latitude from y");
		assertEquals(0, new BigDecimal("-104.987336").compareTo(point.longitude()), "longitude from x");
	}

	/** {@code NUMERIC(9,6)} is what the column holds, so it is what comes back out of here. */
	@Test
	void coordinatesArriveAtTheScaleTheColumnStores() {
		census.expect(requestTo(Matchers.anything()))
				.andRespond(withSuccess(matchAt("-104.987336378379", "39.742007876168"),
						MediaType.APPLICATION_JSON));

		GeoPoint point = located(geocoder.locate(DENVER)).point();

		assertEquals(6, point.latitude().scale());
		assertEquals(6, point.longitude().scale());
	}

	@Test
	void aLocatedAddressIsStreetPrecision() {
		census.expect(requestTo(Matchers.anything()))
				.andRespond(withSuccess(matchAt("-104.987336", "39.742008"), MediaType.APPLICATION_JSON));

		assertEquals(GeocodePrecision.STREET, located(geocoder.locate(DENVER)).precision());
	}

	/**
	 * The address goes out in the fields the service takes, with the benchmark pinned.
	 *
	 * <p>Asserted percent-encoded, because that is what goes on the wire — the matcher reads the
	 * raw query string. Spelling it out here is worth more than hiding it behind a decode.
	 */
	@Test
	void theRequestCarriesTheAddressAndAPinnedBenchmark() {
		census.expect(queryParam("street", "1600%20Broadway"))
				.andExpect(queryParam("city", "Denver"))
				.andExpect(queryParam("state", "CO"))
				.andExpect(queryParam("zip", "80202"))
				.andExpect(queryParam("benchmark", "Public_AR_Current"))
				.andExpect(queryParam("format", "json"))
				.andRespond(withSuccess(noMatch(), MediaType.APPLICATION_JSON));

		geocoder.locate(DENVER);

		census.verify();
	}

	/** A unit line is part of the street field, which is the only place the service takes it. */
	@Test
	void aSuiteNumberIsSentAsPartOfTheStreet() {
		census.expect(queryParam("street", "1600%20Broadway%20Suite%20400"))
				.andRespond(withSuccess(noMatch(), MediaType.APPLICATION_JSON));

		geocoder.locate(new PostalAddress("1600 Broadway", "Suite 400", "Denver", "CO", "80202"));

		census.verify();
	}

	/**
	 * A ZIP+4 is cut to five, the same trim the centroid lookup makes.
	 *
	 * <p>Sent as typed it narrows the search to a block the service does not resolve, so the
	 * address is never matched — and the caller would record that as a real miss and leave the
	 * profile alone for the length of the retry window. The two geocoders have to agree about what
	 * a postal code is, and this is the side that has no table to make it obvious.
	 */
	@Test
	void aZipPlusFourIsCutToFiveDigits() {
		census.expect(queryParam("zip", "80202"))
				.andRespond(withSuccess(noMatch(), MediaType.APPLICATION_JSON));

		geocoder.locate(new PostalAddress("1600 Broadway", null, "Denver", "CO", "80202-1234"));

		census.verify();
	}

	/** An address the service cannot place is an empty list and a 200 — a normal answer. */
	@Test
	void anUnmatchedAddressIsNotFound() {
		census.expect(requestTo(Matchers.anything()))
				.andRespond(withSuccess(noMatch(), MediaType.APPLICATION_JSON));

		assertEquals(GeocodeAnswer.NOT_FOUND, geocoder.locate(DENVER));
	}

	/**
	 * A service that is down is a different answer from an address that does not exist, and the
	 * whole point of the distinction is what the caller does next: a miss is recorded and the
	 * profile is left alone for the retry window, an outage is recorded nowhere and the profile
	 * keeps its place in the queue.
	 *
	 * <p>Still not an exception. Nothing about this may reach the write path.
	 */
	@Test
	void aFailingServiceIsUnavailableRatherThanAMiss() {
		census.expect(requestTo(Matchers.anything())).andRespond(withServerError());

		assertEquals(GeocodeAnswer.UNAVAILABLE, geocoder.locate(DENVER));
	}

	/**
	 * The first match with a point, not the first match. A leading entry without coordinates would
	 * otherwise answer for the whole list and the usable ones behind it would never be read.
	 */
	@Test
	void aMatchWithoutAPointDoesNotHideTheOneBehindIt() {
		census.expect(requestTo(Matchers.anything()))
				.andRespond(withSuccess("""
						{"result":{"addressMatches":[
						  {"coordinates":{"x":null,"y":null}},
						  {"coordinates":{"x":-104.987336,"y":39.742008}}]}}""",
						MediaType.APPLICATION_JSON));

		GeoPoint point = located(geocoder.locate(DENVER)).point();

		assertEquals(0, new BigDecimal("39.742008").compareTo(point.latitude()));
	}

	private static Geocode located(GeocodeAnswer answer) {
		assertInstanceOf(GeocodeAnswer.Located.class, answer, "expected a located address");

		return ((GeocodeAnswer.Located) answer).geocode();
	}

	private static String matchAt(String x, String y) {
		return """
				{"result":{"addressMatches":[{"coordinates":{"x":%s,"y":%s}}]}}""".formatted(x, y);
	}

	private static String noMatch() {
		return """
				{"result":{"addressMatches":[]}}""";
	}
}
