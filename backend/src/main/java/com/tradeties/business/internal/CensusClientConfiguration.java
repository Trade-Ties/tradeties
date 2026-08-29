package com.tradeties.business.internal;

import java.net.http.HttpClient;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/**
 * Builds the one outbound HTTP client this application has.
 *
 * <p><strong>The timeouts are set here rather than as {@code spring.http.client.*} properties,
 * and that is not a preference.</strong> Those properties do not exist on this classpath — Boot 4
 * splits them into a module this build does not have — and an unknown property under
 * {@code spring.*} is ignored without a word. Declared that way they read as configured, apply
 * nothing, and leave the JDK client with no read timeout at all.
 *
 * <p>Which would matter more than a slow call. The only caller is a scheduled pass with
 * {@code fixedDelay}, so the next run is counted from the end of this one: a request that never
 * returns does not delay refinement, it ends it, silently, until the application is restarted.
 * The read timeout is what makes a hung connection a logged failure and a retry in five minutes.
 */
@Configuration(proxyBeanMethods = false)
class CensusClientConfiguration {

	@Bean
	CensusLocations censusLocations(RestClient.Builder builder,
			@Value("${tradeties.census.base-url}") String baseUrl,
			@Value("${tradeties.census.connect-timeout}") Duration connectTimeout,
			@Value("${tradeties.census.read-timeout}") Duration readTimeout) {

		RestClient client = builder
				.baseUrl(baseUrl)
				.requestFactory(requestFactory(connectTimeout, readTimeout))
				.build();

		return HttpServiceProxyFactory
				.builderFor(RestClientAdapter.create(client))
				.build()
				.createClient(CensusLocations.class);
	}

	/**
	 * The connect timeout belongs to the {@link HttpClient} and the read timeout to the factory
	 * around it — two objects, because they are two different waits: one for the connection to be
	 * accepted, one for an answer to arrive over it. Setting only the first leaves an accepted
	 * connection able to hang forever, which is the failure that actually happens to a service
	 * under load.
	 */
	private static JdkClientHttpRequestFactory requestFactory(Duration connectTimeout, Duration readTimeout) {
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
				HttpClient.newBuilder().connectTimeout(connectTimeout).build());
		factory.setReadTimeout(readTimeout);
		return factory;
	}
}
