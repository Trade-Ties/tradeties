package com.tradeties.business.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/**
 * Builds the one outbound HTTP client this application has.
 *
 * <p>Nothing here sets a timeout, deliberately: they are set as properties, on the builder Boot
 * hands in. A {@code requestFactory} configured at this point would replace whatever the builder
 * already carries — which in a test is the thing standing in for the network, and the test would
 * then quietly call the real service instead.
 */
@Configuration(proxyBeanMethods = false)
class CensusClientConfiguration {

	@Bean
	CensusLocations censusLocations(RestClient.Builder builder,
			@Value("${tradeties.census.base-url}") String baseUrl) {

		RestClient client = builder.baseUrl(baseUrl).build();

		return HttpServiceProxyFactory
				.builderFor(RestClientAdapter.create(client))
				.build()
				.createClient(CensusLocations.class);
	}
}
