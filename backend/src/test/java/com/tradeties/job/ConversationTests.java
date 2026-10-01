package com.tradeties.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.jayway.jsonpath.JsonPath;
import com.tradeties.TestcontainersConfiguration;
import com.tradeties.job.JobFixtures.Booking;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Both sides of a conversation about a request, against real PostgreSQL.
 *
 * <p>Every message a test writes carries a UUID of its own, so the email it causes can be found in
 * the outbox the other suites share without counting rows anybody else is also adding.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ConversationTests {

	private static final Pattern REQUEST_LINK = Pattern.compile("http://localhost:3000/([a-z0-9-]+)/requests/(\\S+)");

	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcTemplate jdbc;

	/** A request with nothing said yet still has a first line: what the customer wrote. */
	@Test
	void listsARequestWithItsDescriptionAsTheFirstLine() throws Exception {
		Booking booking = JobFixtures.bookable(mockMvc, "user_conv_list", "conv-list", 60);
		String requestId = JsonPath.read(JobFixtures.place(mockMvc, booking), "$.request.id");

		mockMvc.perform(get("/api/v1/me/conversations").with(booking.owner()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].requestId").value(requestId))
				.andExpect(jsonPath("$[0].customerName").value("Dana Reyes"))
				.andExpect(jsonPath("$[0].request.serviceName").value("Measured job"))
				.andExpect(jsonPath("$[0].lastMessage.author").value("CUSTOMER"))
				.andExpect(jsonPath("$[0].lastMessage.body").value("No hot water since Tuesday."))
				.andExpect(jsonPath("$[0].unreadCount").value(0));

		mockMvc.perform(get("/api/v1/me/conversations/{id}", requestId).with(booking.owner()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.customerEmail").value("dana@example.com"))
				.andExpect(jsonPath("$.description").value("No hot water since Tuesday."))
				.andExpect(jsonPath("$.address.city").value("Colorado Springs"))
				.andExpect(jsonPath("$.messages.length()").value(0));
	}

	/**
	 * A reply reaches the customer by email with a link of its own — and that link works: the
	 * confirmation's token cannot be written again, so this is the only way back the email can give.
	 */
	@Test
	void emailsAReplyWithAFreshLinkThatOpensTheRequest() throws Exception {
		Booking booking = JobFixtures.bookable(mockMvc, "user_conv_reply", "conv-reply", 60);
		String placed = JobFixtures.place(mockMvc, booking);
		String requestId = JsonPath.read(placed, "$.request.id");
		String firstToken = JsonPath.read(placed, "$.accessToken");
		String reply = "Tuesday works, see you then. " + UUID.randomUUID();

		mockMvc.perform(post("/api/v1/me/conversations/{id}/messages", requestId).with(booking.owner())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"body\":\"" + reply + "\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.author").value("BUSINESS"))
				.andExpect(jsonPath("$.body").value(reply));

		String email = jdbc.queryForObject(
				"SELECT body FROM mail_outbox WHERE recipient = 'dana@example.com' AND body LIKE ?", String.class,
				"%" + reply + "%");

		Matcher link = REQUEST_LINK.matcher(email);
		assertThat(link.find()).isTrue();
		assertThat(link.group(1)).isEqualTo("conv-reply");
		String freshToken = link.group(2);
		assertThat(freshToken).isNotEqualTo(firstToken);

		mockMvc.perform(get("/api/v1/jobs/by-token").header("X-Job-Token", freshToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.requests[0].messages.length()").value(1))
				.andExpect(jsonPath("$.requests[0].messages[0].author").value("BUSINESS"))
				.andExpect(jsonPath("$.requests[0].messages[0].body").value(reply));
	}

	/**
	 * The customer answers on their page; the business hears about it by email, sees it unread, and
	 * reading it once is what clears it.
	 */
	@Test
	void countsACustomerMessageUnreadUntilTheBusinessReadsIt() throws Exception {
		Booking booking = JobFixtures.bookable(mockMvc, "user_conv_unread", "conv-unread", 60);
		String placed = JobFixtures.place(mockMvc, booking);
		String requestId = JsonPath.read(placed, "$.request.id");
		String token = JsonPath.read(placed, "$.accessToken");
		String question = "Could you come before noon? " + UUID.randomUUID();

		mockMvc.perform(post("/api/v1/jobs/by-token/requests/{id}/messages", requestId)
						.header("X-Job-Token", token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"body\":\"" + question + "\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.author").value("CUSTOMER"));

		mockMvc.perform(get("/api/v1/me/conversations").with(booking.owner()))
				.andExpect(jsonPath("$[0].unreadCount").value(1))
				.andExpect(jsonPath("$[0].lastMessage.body").value(question));

		String notice = jdbc.queryForObject("SELECT subject FROM mail_outbox WHERE body LIKE ?", String.class,
				"%" + question + "%");
		assertThat(notice).isEqualTo("New message from Dana Reyes");

		mockMvc.perform(post("/api/v1/me/conversations/{id}/read", requestId).with(booking.owner()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/conversations").with(booking.owner()))
				.andExpect(jsonPath("$[0].unreadCount").value(0));
	}

	/**
	 * Another business neither reads nor answers a conversation that is not its own, and is told
	 * nothing about whether it exists.
	 */
	@Test
	void keepsAnotherBusinessOutOfTheConversation() throws Exception {
		Booking mine = JobFixtures.bookable(mockMvc, "user_conv_mine", "conv-mine", 60);
		Booking theirs = JobFixtures.bookable(mockMvc, "user_conv_theirs", "conv-theirs", 60);
		String requestId = JsonPath.read(JobFixtures.place(mockMvc, mine), "$.request.id");

		mockMvc.perform(get("/api/v1/me/conversations/{id}", requestId).with(theirs.owner()))
				.andExpect(status().isNotFound());

		mockMvc.perform(post("/api/v1/me/conversations/{id}/messages", requestId).with(theirs.owner())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"body\":\"Not my request\"}"))
				.andExpect(status().isNotFound());

		mockMvc.perform(get("/api/v1/me/conversations").with(theirs.owner()))
				.andExpect(jsonPath("$.length()").value(0));
	}

	/**
	 * Deleting takes the conversation out of the inbox and nothing more — the customer's link still
	 * opens the request — and their next message brings it back, so nothing they write is lost.
	 */
	@Test
	void aDeletedConversationLeavesTheInboxUntilTheCustomerWritesAgain() throws Exception {
		Booking booking = JobFixtures.bookable(mockMvc, "user_conv_hide", "conv-hide", 60);
		String placed = JobFixtures.place(mockMvc, booking);
		String requestId = JsonPath.read(placed, "$.request.id");
		String token = JsonPath.read(placed, "$.accessToken");

		mockMvc.perform(delete("/api/v1/me/conversations/{id}", requestId).with(booking.owner()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/me/conversations").with(booking.owner()))
				.andExpect(jsonPath("$.length()").value(0));
		mockMvc.perform(get("/api/v1/jobs/by-token").header("X-Job-Token", token))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/jobs/by-token/requests/{id}/messages", requestId)
						.header("X-Job-Token", token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"body\":\"Are you still able to come?\"}"))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/me/conversations").with(booking.owner()))
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].requestId").value(requestId));
	}

	/** Another business cannot take a conversation out of an inbox it does not own. */
	@Test
	void anotherBusinessCannotDeleteTheConversation() throws Exception {
		Booking mine = JobFixtures.bookable(mockMvc, "user_conv_keep", "conv-keep", 60);
		Booking theirs = JobFixtures.bookable(mockMvc, "user_conv_other_del", "conv-other-del", 60);
		String requestId = JsonPath.read(JobFixtures.place(mockMvc, mine), "$.request.id");

		mockMvc.perform(delete("/api/v1/me/conversations/{id}", requestId).with(theirs.owner()))
				.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/v1/me/conversations").with(mine.owner()))
				.andExpect(jsonPath("$.length()").value(1));
	}

	/** A token opens one job, and no other job's conversation through it. */
	@Test
	void keepsATokenToItsOwnJob() throws Exception {
		Booking one = JobFixtures.bookable(mockMvc, "user_conv_one", "conv-one", 60);
		Booking other = JobFixtures.bookable(mockMvc, "user_conv_other", "conv-other", 60);
		String myToken = JsonPath.read(JobFixtures.place(mockMvc, one), "$.accessToken");
		String otherRequest = JsonPath.read(JobFixtures.place(mockMvc, other), "$.request.id");

		mockMvc.perform(post("/api/v1/jobs/by-token/requests/{id}/messages", otherRequest)
						.header("X-Job-Token", myToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"body\":\"Hello\"}"))
				.andExpect(status().isNotFound());
	}

	/** Whitespace passes the contract's length check and is refused here. */
	@Test
	void refusesAMessageOfNothingButSpaces() throws Exception {
		Booking booking = JobFixtures.bookable(mockMvc, "user_conv_blank", "conv-blank", 60);
		String requestId = JsonPath.read(JobFixtures.place(mockMvc, booking), "$.request.id");

		mockMvc.perform(post("/api/v1/me/conversations/{id}/messages", requestId).with(booking.owner())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"body\":\"   \"}"))
				.andExpect(status().isBadRequest());
	}
}
