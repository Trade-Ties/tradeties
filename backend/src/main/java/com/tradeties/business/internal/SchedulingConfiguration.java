package com.tradeties.business.internal;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Switches on scheduled work, which this application had none of before {@link GeocodeRefiner}.
 *
 * <p>Application-wide, which is the thing to know about it: any {@code @Scheduled} method added
 * anywhere from here on runs, including in a test run. That is why the refiner carries its own
 * property and why {@code src/test/resources/application.properties} turns it off — a suite that
 * called a free public service a few hundred times a day would be nobody's intention and
 * everybody's traffic.
 *
 * <p>Also worth knowing before the deployment grows: a scheduled method runs in <em>every</em>
 * instance. Harmless for this one, whose work is idempotent and whose duplicate calls cost
 * nothing, and the point at which that stops being true is written up in DECISIONS section 10.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
class SchedulingConfiguration {
}
