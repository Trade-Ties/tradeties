-- ---------------------------------------------------------------------------
-- Module `job`: what a customer wants done, and the requests they send about it.
--
-- Two tables and not one, because they are two aggregates. A job is the need --
-- an address, a description, a way to reach somebody. A request is that need
-- put to ONE business, for ONE service, at ONE start. DECISIONS section 1 sends
-- the same job to several tradespeople in parallel, each deciding alone, and no
-- invariant spans the requests: one acceptance changes none of the others.
--
-- Nothing here can be accepted yet. The inbox arrives in the next slice, and
-- the constraints that only bite on ACCEPTED rows are written now anyway -- see
-- the note above the exclusion constraint.
-- ---------------------------------------------------------------------------

CREATE TABLE job
(
    id               UUID         NOT NULL PRIMARY KEY,

    -- Customers are anonymous today (DECISIONS section 1). This column is the
    -- seam for later: RegistrationIntent already has the shape to take CUSTOMER,
    -- and a job sent before an account existed can then be adopted by one.
    customer_user_id UUID         REFERENCES identity_user (id),
    customer_name    VARCHAR(200) NOT NULL,
    customer_email   VARCHAR(320) NOT NULL,
    customer_phone   VARCHAR(16),

    -- Bounded for the reason business_profile.description is, and to the same figure
    -- the contract caps it at. TEXT would accept a megabyte nobody will read.
    description      VARCHAR(2000) NOT NULL,
    trade_id         UUID         NOT NULL REFERENCES trade (id),

    street1          VARCHAR(200) NOT NULL,
    street2          VARCHAR(200),
    city             VARCHAR(100) NOT NULL,
    state            CHAR(2)      NOT NULL,
    postal_code      VARCHAR(10)  NOT NULL,
    latitude         NUMERIC(9, 6),
    longitude        NUMERIC(9, 6),

    -- The zone every appointment on this job is read against.
    --
    -- DECISIONS section 1 asks for the JOB SITE's zone. What is written here is
    -- the business's own, and the difference is a gap in the data rather than a
    -- shortcut: zip_centroid carries (zip, latitude, longitude) and no zone, so a
    -- site's zone cannot be derived from the address the customer typed. The
    -- business's is the honest stand-in -- the slot came out of their working
    -- week and was displayed on their clock. Give the postal table a zone and
    -- this is the column that starts meaning what DECISIONS says.
    time_zone        VARCHAR(64)  NOT NULL,

    -- Without an account a customer needs a way back to their own job. The
    -- SHA-256 is stored and never the token: this row is otherwise a password
    -- store in the clear.
    access_token_hash       VARCHAR(64)                NOT NULL,
    access_token_expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    version    BIGINT                      NOT NULL,

    -- The same pair of checks the business profile carries. A half-geocoded site
    -- would otherwise surface first in a radius search, far from here.
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);

-- The lookup behind the customer's link. Unique because the hash IS the
-- identity of that link, and two jobs sharing one would make it ambiguous.
CREATE UNIQUE INDEX job_by_access_token_uidx ON job (access_token_hash);

-- Lower-cased because mail addresses are not case sensitive in practice and a
-- customer typing theirs again will not reproduce the capitals.
CREATE INDEX job_by_customer_email_idx ON job (lower(customer_email), created_at DESC);

-- No `status` column on purpose. Whether a job has anything outstanding is a
-- count over its requests, and a maintained column beside that count is the
-- second place for one truth -- which is the place that drifts.


CREATE TABLE job_request
(
    id          UUID NOT NULL PRIMARY KEY,

    -- No CASCADE. A request is its own aggregate and carries fee and payment
    -- references once accepted; a deletion request against a job must not take
    -- receipts with it. Meaningless drafts are for an explicit cleanup to remove.
    job_id      UUID NOT NULL REFERENCES job (id),
    business_id UUID NOT NULL REFERENCES business_profile (id),
    service_id  UUID NOT NULL,

    starts_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    ends_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    status      VARCHAR(32)                 NOT NULL,

    -- The snapshot. What was displayed is what binds, so the terms are frozen
    -- here as the customer saw them -- a business raising its cancellation fee
    -- tomorrow must not make today's request more expensive. The foreign keys
    -- above answer "what was meant"; these columns answer "what was agreed".
    currency                            CHAR(3)       NOT NULL,
    service_name_snapshot               VARCHAR(160)  NOT NULL,
    estimated_duration_minutes_snapshot INTEGER       NOT NULL,
    service_pricing_mode_snapshot       VARCHAR(32)   NOT NULL,
    service_price_snapshot              NUMERIC(19, 4),
    hourly_rate_snapshot                NUMERIC(19, 4),

    -- Resolved when the request is sent: the service's own price when HOURLY set
    -- one, otherwise the business's general rate. Billing should not have to work
    -- out afterwards which of the two sources applied -- that override is exactly
    -- the ambiguity the pricing model allows on purpose.
    effective_hourly_rate_snapshot      NUMERIC(19, 4),
    service_call_fee_snapshot           NUMERIC(19, 4),
    cancellation_fee_snapshot           NUMERIC(19, 4) NOT NULL,
    cancellation_notice_hours_snapshot  INTEGER        NOT NULL,

    decided_at               TIMESTAMP(6) WITH TIME ZONE,
    decline_reason           VARCHAR(500),
    withdrawn_at             TIMESTAMP(6) WITH TIME ZONE,
    cancelled_at             TIMESTAMP(6) WITH TIME ZONE,
    cancelled_by             VARCHAR(16),
    cancellation_fee_charged NUMERIC(19, 4),
    completed_at             TIMESTAMP(6) WITH TIME ZONE,

    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    version    BIGINT                      NOT NULL,

    -- The service must belong to the business being asked. Without this key a
    -- request to firm A could carry firm B's service -- and B's duration and
    -- price in the snapshot above.
    FOREIGN KEY (business_id, service_id) REFERENCES business_service (business_id, id),

    -- Foreign key target for review and payment_transaction, which arrive later.
    UNIQUE (id, business_id),

    CHECK (ends_at > starts_at),
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED',
                      'WITHDRAWN', 'CANCELLED', 'COMPLETED')),
    CHECK (cancelled_by IS NULL OR cancelled_by IN ('CUSTOMER', 'BUSINESS')),

    -- Timestamps and status are two renderings of one fact and must not diverge.
    -- Without these, COMPLETED with no completed_at is a legal row, and a report
    -- on turnaround times then quietly averages over NULL.
    CHECK ((withdrawn_at IS NOT NULL) = (status = 'WITHDRAWN')),
    CHECK ((completed_at IS NOT NULL) = (status = 'COMPLETED')),
    CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)),
    CHECK ((decided_at IS NOT NULL) = (status IN ('ACCEPTED', 'DECLINED',
                                                  'CANCELLED', 'COMPLETED'))),
    CHECK (cancellation_fee_charged IS NULL OR cancellation_fee_charged >= 0),
    CHECK (cancellation_fee_charged IS NULL OR status = 'CANCELLED'),

    -- A business cancelling costs the customer nothing. The fee is the business's
    -- charge for CUSTOMER cancellations, not for its own.
    CHECK (cancelled_by IS DISTINCT FROM 'BUSINESS'
        OR coalesce(cancellation_fee_charged, 0) = 0)
);

-- The second acceptance loses in the database rather than in hopeful
-- application code. A range and not a start time, because appointments differ in
-- length with the service; '[)' like the working hours, so 09:00-10:00 and
-- 10:00-11:00 are two appointments and not an overlap.
--
-- Written now although nothing can reach ACCEPTED yet. It costs nothing against
-- zero matching rows, and the alternative is a migration in the slice that first
-- needs it -- by which time there is live data to apply it to.
ALTER TABLE job_request
    ADD CONSTRAINT job_request_no_overlapping_appointments
        EXCLUDE USING gist (business_id WITH =,
                            tstzrange(starts_at, ends_at, '[)') WITH &&)
        WHERE (status = 'ACCEPTED');

-- One live request per business and job. After a decline the customer may ask
-- the same business again, which is why the filter names the two live states
-- rather than excluding the dead ones.
CREATE UNIQUE INDEX job_request_live_per_business_uidx
    ON job_request (job_id, business_id)
    WHERE status IN ('PENDING', 'ACCEPTED');

CREATE INDEX job_request_by_job_idx ON job_request (job_id);
CREATE INDEX job_request_inbox_idx ON job_request (business_id, status, starts_at);
CREATE INDEX job_request_by_service_idx ON job_request (service_id);
