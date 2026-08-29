package com.tradeties.business;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Onboarding steps 1 and 2 against real PostgreSQL, including the constraints that only
 * exist in the schema.
 *
 * <p>Each test uses its own WorkOS subject and its own slug, so nothing needs cleaning up
 * and nothing depends on execution order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BusinessProfileTests {

	@Autowired
	MockMvc mockMvc;

	/**
	 * The contract's {@code security: []} is only a declaration; {@code SecurityConfig} is what
	 * opens it.
	 */
	@Test
	void tradesAreReadableWithoutAToken() throws Exception {
		mockMvc.perform(get("/api/v1/trades"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].code").value("PLUMBER"))
				.andExpect(jsonPath("$[0].displayName").value("Plumber"));
	}

	@Test
	void statesAreReadableWithoutATokenAndStartAlphabetically() throws Exception {
		mockMvc.perform(get("/api/v1/us-states"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(51))
				.andExpect(jsonPath("$[0].code").value("AL"));
	}

	@Test
	void theProfileIsNotReadableAnonymously() throws Exception {
		mockMvc.perform(get("/api/v1/me/business"))
				.andExpect(status().isUnauthorized());
	}

	/**
	 * 404 before onboarding step 2 is the normal answer, not a failure — it is how the
	 * wizard decides to start at step 1.
	 */
	@Test
	void aTradespersonWithoutAProfileGetsNotFound() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_no_profile");

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(status().isNotFound());
	}

	@Test
	void creatingStoresADraftAtStepTwo() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_creates");

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("acme-plumbing")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("DRAFT"))
				.andExpect(jsonPath("$.onboardingCompletedStep").value(2))
				.andExpect(jsonPath("$.slug").value("acme-plumbing"))
				.andExpect(jsonPath("$.version").value(0));

		mockMvc.perform(get("/api/v1/me/business").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.displayName").value("Acme Plumbing"));
	}

	@Test
	void asecondProfileForTheSameAccountIsRejected() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_twice");

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("first-shop")))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("second-shop")))
				.andExpect(status().isConflict());
	}

	@Test
	void aSlugAlreadyTakenIsRejected() throws Exception {
		mockMvc.perform(post("/api/v1/me/business").with(registeredTradesperson("user_slug_owner"))
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("contested-slug")))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/me/business").with(registeredTradesperson("user_slug_rival"))
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("contested-slug")))
				.andExpect(status().isConflict());
	}

	/**
	 * A valid token is not enough to own a business. Someone who authenticated but never
	 * registered has no marketplace role, and creating a profile for them would leave an
	 * owner who cannot act on it.
	 */
	@Test
	void anUnregisteredCallerCannotCreateAProfile() throws Exception {
		mockMvc.perform(post("/api/v1/me/business").with(tokenFor("user_unregistered"))
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("ghost-shop")))
				.andExpect(status().isForbidden());
	}

	/**
	 * "XX" satisfies the contract's two-upper-case-letters pattern and then fails the foreign
	 * key on {@code us_state}. Without a check before the write, that violation is
	 * indistinguishable from a lost slug race and gets reported as "that slug is taken".
	 */
	@Test
	void aStateThatIsNotAStateIsRejected() throws Exception {
		mockMvc.perform(post("/api/v1/me/business").with(registeredTradesperson("user_bad_state"))
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("ghost-state").replace("\"CO\"", "\"XX\"")))
				.andExpect(status().isBadRequest());
	}

	/**
	 * The content type is the assertion that matters here, and it is not decoration.
	 * {@code spring.mvc.problemdetails.enabled} is what turns Spring's own validation failure
	 * into an RFC 9457 body; without it Boot renders its default error shape
	 * ({@code timestamp}, {@code error}, {@code path}) as plain {@code application/json}, and
	 * every {@code 400} in {@code openapi.yaml} that points at the {@code Problem} schema
	 * becomes a promise the API does not keep.
	 *
	 * <p>Nothing else notices if that setting is switched off: every other test here stops at the
	 * status code.
	 */
	@Test
	void aPayloadThatViolatesTheContractIsRejectedBeforeTheDatabase() throws Exception {
		mockMvc.perform(post("/api/v1/me/business").with(registeredTradesperson("user_bad_slug"))
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("Not A Valid Slug")))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith("application/problem+json"));
	}

	/**
	 * The behaviour the contract promises, and the reason this is a PUT rather than a PATCH.
	 */
	@Test
	void replacingWithoutADescriptionClearsIt() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_replaces");

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("before-shop")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.description").value("Drains, and nothing but drains"));

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "version": 0,
								  "slug": "after-shop",
								  "legalName": "Acme Plumbing LLC",
								  "displayName": "Acme Plumbing",
								  "phone": "+13035550101",
								  "email": "dispatch@acme.example",
								  "address": {
								    "street1": "123 Main St",
								    "city": "Denver",
								    "state": "CO",
								    "postalCode": "80202"
								  },
								  "timeZone": "America/Denver",
								  "serviceRadiusMiles": 40
								}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slug").value("after-shop"))
				.andExpect(jsonPath("$.serviceRadiusMiles").value(40))
				.andExpect(jsonPath("$.description").doesNotExist())
				.andExpect(jsonPath("$.version").value(1));
	}

	/**
	 * A stale version means the caller edited something that moved on. Hibernate's own
	 * {@code @Version} would not catch this — by the time the row is loaded its version is
	 * the current one — which is why the service compares against what the caller last saw.
	 */
	@Test
	void replacingWithAStaleVersionIsRejected() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_stale");

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("stale-shop")))
				.andExpect(status().isCreated());

		mockMvc.perform(put("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "version": 99,
								  "slug": "stale-shop",
								  "legalName": "Acme Plumbing LLC",
								  "displayName": "Renamed",
								  "phone": "+13035550101",
								  "email": "dispatch@acme.example",
								  "address": {
								    "street1": "123 Main St",
								    "city": "Denver",
								    "state": "CO",
								    "postalCode": "80202"
								  },
								  "timeZone": "America/Denver",
								  "serviceRadiusMiles": 25
								}"""))
				.andExpect(status().isConflict());
	}

	/**
	 * Availability is a question about the caller, not about the namespace in the abstract.
	 *
	 * <p>The slug a business already holds is not taken <em>from it</em>, and the update of steps 1
	 * and 2 is a full replacement — the slug arrives on every write whether or not anybody
	 * touched it. Answering "unavailable" to the holder would have the URL field report the
	 * business's own address as gone, which is a wrong answer rather than a cautious one. It is
	 * still taken for everybody else, which is the half a unique index alone would give.
	 */
	@Test
	void theSlugCheckAnswersForTheCaller() throws Exception {
		RequestPostProcessor holder = registeredTradesperson("user_checks_slug");

		mockMvc.perform(get("/api/v1/me/business/slug-available").with(holder).param("slug", "still-free"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.available").value(true));

		mockMvc.perform(post("/api/v1/me/business").with(holder)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("still-free")))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/me/business/slug-available").with(holder).param("slug", "still-free"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.available").value(true));

		RequestPostProcessor somebodyElse = registeredTradesperson("user_wants_that_slug");

		mockMvc.perform(
				get("/api/v1/me/business/slug-available").with(somebodyElse).param("slug", "still-free"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.available").value(false));
	}

	/**
	 * Both halves are needed and neither covers the other. {@code minLength: 1} in the
	 * contract stops the empty string, which is what an unfilled form field sends. It cannot
	 * stop a single space: bean validation counts characters, and one space is one character —
	 * so without the trim at the edge it satisfies the length, satisfies {@code NOT NULL}, and
	 * publishes a business whose name renders as nothing at all.
	 */
	@Test
	void aNameThatIsOnlyWhitespaceIsRefused() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_blank_name");

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("blank-name").replace("\"Acme Plumbing\"", "\"   \"")))
				.andExpect(status().isBadRequest());

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("empty-name").replace("\"Acme Plumbing\"", "\"\"")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void aBlankAddressLineIsRefused() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_blank_address");

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("blank-city").replace("\"Denver\"", "\" \"")))
				.andExpect(status().isBadRequest());
	}

	/** Surrounding space is not part of a name, and only the unique index would ever say so. */
	@Test
	void aNameIsStoredWithoutItsSurroundingSpace() throws Exception {
		RequestPostProcessor token = registeredTradesperson("user_padded_name");

		mockMvc.perform(post("/api/v1/me/business").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(profileJson("padded-name").replace("\"Acme Plumbing\"", "\"  Acme Plumbing  \"")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.displayName").value("Acme Plumbing"));
	}

	/** Goes through the real registration endpoint, so the role is granted the way it is in production. */
	private RequestPostProcessor registeredTradesperson(String subject) throws Exception {
		RequestPostProcessor token = tokenFor(subject);

		mockMvc.perform(post("/api/v1/me/registration").with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"intent":"TRADESPERSON"}"""))
				.andExpect(status().isOk());

		return token;
	}

	private static RequestPostProcessor tokenFor(String subject) {
		return jwt().jwt(token -> token.subject(subject).claim("email", subject + "@example.com"));
	}

	private static String profileJson(String slug) {
		return """
				{
				  "slug": "%s",
				  "legalName": "Acme Plumbing LLC",
				  "displayName": "Acme Plumbing",
				  "description": "Drains, and nothing but drains",
				  "phone": "+13035550101",
				  "email": "dispatch@acme.example",
				  "address": {
				    "street1": "123 Main St",
				    "street2": "Suite 4",
				    "city": "Denver",
				    "state": "CO",
				    "postalCode": "80202"
				  },
				  "timeZone": "America/Denver",
				  "serviceRadiusMiles": 25
				}""".formatted(slug);
	}
}
