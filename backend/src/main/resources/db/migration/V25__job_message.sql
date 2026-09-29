-- ---------------------------------------------------------------------------
-- Module `job`: the conversation between a customer and the business they sent
-- a request to, and the extra links that let the customer back into it.
--
-- One conversation per REQUEST, not per job. A job can go to several businesses
-- in parallel (DECISIONS section 1), and each of them talks to the customer on
-- its own: what one tradesperson asks must not appear in another's inbox. The
-- request is exactly that pairing -- one customer, one business -- so the thread
-- hangs off it.
--
-- The request's own description is not copied in as a first message. It is the
-- job's, it is already stored, and the conversation starts after it.
-- ---------------------------------------------------------------------------

CREATE TABLE job_message
(
    id             UUID          NOT NULL PRIMARY KEY,
    job_request_id UUID          NOT NULL REFERENCES job_request (id) ON DELETE CASCADE,

    -- Who wrote it. Not a user id: the customer has no account, and the business
    -- side is the business rather than whichever login was used to answer.
    author         VARCHAR(16)   NOT NULL,

    -- Bounded like every other free text here. A message is read in an inbox and
    -- in an email; five thousand characters is several screens of either.
    body           VARCHAR(5000) NOT NULL,

    created_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    -- When the OTHER side first read it. Only the business side tracks this for
    -- now -- it is what the inbox's unread count is -- so a customer's message is
    -- stamped when the tradesperson opens the conversation.
    read_at        TIMESTAMP(6) WITH TIME ZONE,

    CHECK (author IN ('BUSINESS', 'CUSTOMER')),
    CHECK (length(btrim(body)) > 0),
    CHECK (read_at IS NULL OR read_at >= created_at)
);

-- A thread read in order, and the inbox asking for each thread's latest line.
CREATE INDEX job_message_thread_idx ON job_message (job_request_id, created_at);

-- The unread count: customer messages nobody on the business side has opened.
CREATE INDEX job_message_unread_idx ON job_message (job_request_id)
    WHERE author = 'CUSTOMER' AND read_at IS NULL;

-- ---------------------------------------------------------------------------
-- More ways back to one job.
--
-- job.access_token_hash is the link from the first confirmation, and its clear
-- value existed only while the request was being written. Every later email --
-- a tradesperson's reply above all -- needs a link of its own, and it cannot be
-- that one: nothing can read it back. So each such email is issued a fresh token,
-- stored here the same way, as a digest with an expiry.
--
-- Separate rather than a list on job, so a link can be revoked on its own and an
-- old email can stop working without the others.
-- ---------------------------------------------------------------------------

CREATE TABLE job_access_token
(
    token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    job_id     UUID        NOT NULL REFERENCES job (id) ON DELETE CASCADE,
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CHECK (expires_at > created_at)
);

CREATE INDEX job_access_token_job_idx ON job_access_token (job_id);
