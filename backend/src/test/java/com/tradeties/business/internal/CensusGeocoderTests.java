package com.tradeties.business.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.math.BigDecimal;
import java.util.Optional;

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

		GeoPoint point = geocoder.locate(DENVER).orElseThrow().point();

		assertEquals(0, new BigDecimal("39.742008").compareTo(point.latitude()), "latitude from y");
		assertEquals(0, new BigDecimal("-104.987336").compareTo(point.longitude()), "longitude from x");
	}

	/** {@code NUMERIC(9,6)} is what the column holds, so it is what comes back out of here. */
	@Test
	void coordinatesArriveAtTheScaleTheColumnStores() {
		census.expect(requestTo(Matchers.anything()))
				.andRespond(withSuccess(matchAt("-104.987336378379", "39.742007876168"),
						MediaType.APPLICATION_JSON));

		GeoPoint point = geocoder.locate(DENVER).orElseThrow().point();

		assertEquals(6, point.latitude().scale());
		assertEquals(6, point.longitude().scale());
	}

	@Test
	void aLocatedAddressIsStreetPrecision() {
		census.expect(requestTo(Matchers.anything()))
				.andRespond(withSuccess(matchAt("-104.987336", "39.742008"), MediaType.APPLICATION_JSON));

		assertEquals(GeocodePrecision.STREET, geocoder.locate(DENVER).orElseThrow().precision());
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

	/** An address the service cannot place is an empty list and a 200 — a normal answer. */
	@Test
	void anUnmatchedAddressIsEmpty() {
		census.expect(requestTo(Matchers.anything()))
				.andRespond(withSuccess(noMatch(), MediaType.APPLICATION_JSON));

		assertTrue(geocoder.locate(DENVER).isEmpty());
	}

	/**
	 * A service that is down leaves the profile on the ZIP centroid it already has. The caller
	 * cannot act on the difference between "no such address" and "nobody answered", so it is not
	 * asked to — this must not become an exception that reaches the write path.
	 */
	@Test
	void aFailingServiceIsEmptyRatherThanAnException() {
		census.expect(requestTo(Matchers.anything())).andRespond(withServerError());

		Optional<Geocode> located = geocoder.locate(DENVER);

		assertTrue(located.isEmpty());
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
