package com.tradeties.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tradeties.TestcontainersConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The registration half of the first vertical slice, against real PostgreSQL.
 *
 * <p>Each test uses its own WorkOS subject id, so no cleanup is needed between them and
 * nothing depends on execution order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class IdentityRegistrationTests {

	private static final String TRADESPERSON_REQUEST = """
			{"intent":"TRADESPERSON"}""";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbcTemplate;

	@Test
	void registrationRejectsAnonymousCallers() throws Exception {
		mockMvc.perform(post("/api/v1/me/registration")
						.contentType(MediaType.APPLICATION_JSON)
						.content(TRADESPERSON_REQUEST))
				.andExpect(status().isUnauthorized());
	}

	/**
	 * The state a tradesperson is in between signing in and completing registration. Not an
	 * error: they hold a valid token, they are simply not a member of the marketplace yet,
	 * and the portal reads exactly this to decide where to send them.
	 */
	@Test
	void signedInButUnregisteredCallerHasNoRoles() throws Exception {
		mockMvc.perform(get("/api/v1/me").with(tokenFor("user_unregistered", "sam@example.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.userId").value("user_unregistered"))
				.andExpect(jsonPath("$.roles").isEmpty());

		assertEquals(0, projectionsFor("user_unregistered"),
				"GET /api/v1/me must not create a user row — it is a read");
	}

	@Test
	void registeringAsTradespersonGrantsBusinessOwner() throws Exception {
		mockMvc.perform(post("/api/v1/me/registration")
						.with(tokenFor("user_new_pro", "rosa@example.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content(TRADESPERSON_REQUEST))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.userId").value("user_new_pro"))
				.andExpect(jsonPath("$.email").value("rosa@example.com"))
				.andExpect(jsonPath("$.roles.length()").value(1))
				.andExpect(jsonPath("$.roles[0]").value("BUSINESS_OWNER"));
	}

	/**
	 * The portal re-posts registration on every sign-in, so this is the normal path, not an
	 * edge case. Asserted at the row level rather than only through the response: a second
	 * projection of the same person would be invisible in the JSON but corrupt in the data.
	 */
	@Test
	void registeringTwiceIsIdempotent() throws Exception {
		RequestPostProcessor token = tokenFor("user_returning", "kai@example.com");

		for (int signIn = 0; signIn < 2; signIn++) {
			mockMvc.perform(post("/api/v1/me/registration")
							.with(token)
							.contentType(MediaType.APPLICATION_JSON)
							.content(TRADESPERSON_REQUEST))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.roles.length()").value(1));
		}

		assertEquals(1, projectionsFor("user_returning"), "second sign-in created a second user row");
		assertEquals(1, rolesFor("user_returning"), "granting a held role must be a no-op");
	}

	@Test
	void currentUserReflectsAnEarlierRegistration() throws Exception {
		RequestPostProcessor token = tokenFor("user_persisted", "ada@example.com");

		mockMvc.perform(post("/api/v1/me/registration")
						.with(token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(TRADESPERSON_REQUEST))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/me").with(token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value("ada@example.com"))
				.andExpect(jsonPath("$.roles[0]").value("BUSINESS_OWNER"));
	}

	/**
	 * The identity is taken from the validated token, never from the body. A caller who
	 * names someone else must not be able to register on their behalf.
	 */
	@Test
	void registrationIgnoresAUserIdSuppliedInTheBody() throws Exception {
		mockMvc.perform(post("/api/v1/me/registration")
						.with(tokenFor("user_caller", "caller@example.com"))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"intent":"TRADESPERSON","userId":"user_victim"}"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.userId").value("user_caller"));

		assertEquals(0, projectionsFor("user_victim"), "a body field must never create another user");
	}

	private static RequestPostProcessor tokenFor(String subject, String email) {
		return jwt().jwt(token -> token.subject(subject).claim("email", email));
	}

	private int projectionsFor(String workosUserId) {
		return jdbcTemplate.queryForObject(
				"SELECT count(*) FROM identity_user WHERE workos_user_id = ?", Integer.class, workosUserId);
	}

	private int rolesFor(String workosUserId) {
		return jdbcTemplate.queryForObject("""
				SELECT count(*) FROM identity_user_role r
				JOIN identity_user u ON u.id = r.user_id
				WHERE u.workos_user_id = ?""", Integer.class, workosUserId);
	}
}