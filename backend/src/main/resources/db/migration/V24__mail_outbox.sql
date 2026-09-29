-- ---------------------------------------------------------------------------
-- Module `mail`: email waiting to be sent, and a record of what was.
--
-- An outbox rather than a send, because the two halves have to agree. The
-- confirmation for a request is written in the same transaction as the request:
-- a request that rolls back leaves no email behind, and one that commits cannot
-- lose its email to an SMTP server that happened to be down for a minute. The
-- sending happens afterwards, from here, and is retried until it goes.
--
-- A table of its own rather than Spring Modulith's event_publication, for the
-- column below that has to be emptied. The customer has no account; the link
-- in their confirmation is the only way back to their request, and it carries
-- the access token in the clear. job stores that token only as a digest, so a
-- copy sitting here in a mail body would undo it. The body lives exactly as long
-- as it has to -- until it is sent -- and is then set to NULL.
-- ---------------------------------------------------------------------------

CREATE TABLE mail_outbox
(
    id              UUID         NOT NULL PRIMARY KEY,

    -- RFC 5321 caps an address at 254 in practice; job.customer_email allows 320
    -- and this takes whatever that column can hold.
    recipient       VARCHAR(320) NOT NULL,
    subject         VARCHAR(300) NOT NULL,

    -- Plain text. NULL once sent -- see above -- and never before.
    body            TEXT,

    status          VARCHAR(16)  NOT NULL,
    attempts        INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    -- The last refusal, for whoever reads a FAILED row. Trimmed to fit: an SMTP
    -- error can run to a stack of nested causes.
    last_error      VARCHAR(500),

    created_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    sent_at         TIMESTAMP(6) WITH TIME ZONE,

    CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    CHECK (attempts >= 0),
    -- Status and timestamp are two renderings of one fact.
    CHECK ((status = 'SENT') = (sent_at IS NOT NULL)),
    -- A body is emptied by sending it and by nothing else, so an unsent row that
    -- has lost it is a bug, not a state.
    CHECK (body IS NOT NULL OR status = 'SENT')
);

-- What the sender asks every few seconds: which of the waiting ones are due.
-- Partial, because SENT rows pile up forever and are never asked about.
CREATE INDEX mail_outbox_due_idx ON mail_outbox (next_attempt_at) WHERE status = 'PENDING';
