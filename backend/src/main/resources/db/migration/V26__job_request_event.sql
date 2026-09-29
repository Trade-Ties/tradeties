-- The history of a request: every change of status, who made it, and when.
--
-- The columns on job_request say where a request stands; only this table says
-- how it got there. In a dispute over a cancellation fee "who cancelled, and
-- when" is the first question, and an overwritten column cannot answer it.
--
-- Append-only by convention. Nothing here stops an UPDATE; treating the table as
-- evidence means revoking UPDATE and DELETE on it from the application role.
CREATE TABLE job_request_event
(
    id              UUID        NOT NULL PRIMARY KEY,
    request_id      UUID        NOT NULL REFERENCES job_request (id) ON DELETE CASCADE,

    -- Per request, and the order to read in. Two transitions in one transaction
    -- can share a microsecond, so occurred_at alone does not order them.
    sequence_number INTEGER     NOT NULL,
    from_status     VARCHAR(32),
    to_status       VARCHAR(32) NOT NULL,

    -- The person who decided, not the process that executed it: a decline picked
    -- from a list in the time-off dialog is BUSINESS, not SYSTEM.
    actor           VARCHAR(16) NOT NULL,
    note            VARCHAR(500),
    occurred_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CHECK (sequence_number > 0),
    CHECK (actor IN ('CUSTOMER', 'BUSINESS', 'SYSTEM')),
    CHECK (from_status IS NULL OR from_status IN ('PENDING', 'ACCEPTED', 'DECLINED',
                                                  'WITHDRAWN', 'CANCELLED', 'COMPLETED')),
    CHECK (to_status IN ('PENDING', 'ACCEPTED', 'DECLINED',
                         'WITHDRAWN', 'CANCELLED', 'COMPLETED'))
);

CREATE UNIQUE INDEX job_request_event_by_request_uidx
    ON job_request_event (request_id, sequence_number);

-- What happened before this table existed. Every request so far was sent by a
-- customer, and only a business could decide one.
INSERT INTO job_request_event (id, request_id, sequence_number, from_status, to_status, actor, occurred_at)
SELECT gen_random_uuid(), id, 1, NULL, 'PENDING', 'CUSTOMER', created_at
FROM job_request;

INSERT INTO job_request_event (id, request_id, sequence_number, from_status, to_status, actor, occurred_at)
SELECT gen_random_uuid(), id, 2, 'PENDING', status, 'BUSINESS', decided_at
FROM job_request
WHERE status IN ('ACCEPTED', 'DECLINED');
