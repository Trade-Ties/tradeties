/**
 * Job — what a customer wants done, and the requests they send about it.
 *
 * <p>The first module whose writes come from nobody. Everything else here is written by a
 * tradesperson holding a token; a customer has no account at all, so a job arrives anonymously
 * and carries its own credential back out — the access token, which is the whole of their way to
 * what they sent.
 *
 * <p><strong>A job and a request are two aggregates, not a parent and a child.</strong> The job
 * is the need; a request is that need put to one business at one time. The same job goes to
 * several tradespeople in parallel and each decides alone, so no invariant spans the requests and
 * nothing forces them into one consistency boundary — two acceptances in the same second never
 * contend for one row.
 *
 * <p><strong>The terms are copied, never referenced.</strong> What the customer was shown is what
 * binds, so every price, duration and fee is frozen onto the request as it is sent. That is why
 * this module depends on {@code business} and why {@code business} knows nothing of it: a profile
 * edited tomorrow must leave every request already sent exactly as it was.
 *
 * <p>A business can also put an appointment in its calendar itself. It is stored like an accepted
 * request, so the overlap constraint and the free-slot subtraction cover it without a second path.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Job")
package com.tradeties.job;
