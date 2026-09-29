-- Jobs and appointments a business enters itself: a customer who phoned, a
-- regular. Two facts, on two tables, because they come apart when a business
-- books a time agreed with a customer in place of the one that customer asked
-- for: the job stays the customer's, the appointment is the business's.

-- Who entered the job. Everything V23 required of a job holds for one a customer
-- sent; one a business entered needs only a name. Existing rows are all the
-- customer's, and the default is dropped so no later insert can inherit it.
ALTER TABLE job
    ADD COLUMN created_by VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE job
    ALTER COLUMN created_by DROP DEFAULT;
ALTER TABLE job
    ADD CONSTRAINT job_created_by_known CHECK (created_by IN ('CUSTOMER', 'BUSINESS'));

ALTER TABLE job
    ALTER COLUMN customer_email DROP NOT NULL,
    ALTER COLUMN description DROP NOT NULL,
    ALTER COLUMN street1 DROP NOT NULL,
    ALTER COLUMN city DROP NOT NULL,
    ALTER COLUMN state DROP NOT NULL,
    ALTER COLUMN postal_code DROP NOT NULL,
    ALTER COLUMN access_token_hash DROP NOT NULL,
    ALTER COLUMN access_token_expires_at DROP NOT NULL;

ALTER TABLE job
    ADD CONSTRAINT job_sent_by_customer_is_complete CHECK (
        created_by = 'BUSINESS'
        OR (customer_email IS NOT NULL AND description IS NOT NULL
            AND street1 IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL
            AND postal_code IS NOT NULL
            AND access_token_hash IS NOT NULL AND access_token_expires_at IS NOT NULL));

ALTER TABLE job
    ADD CONSTRAINT job_access_token_pair CHECK ((access_token_hash IS NULL) = (access_token_expires_at IS NULL));

-- Who put the appointment in the calendar. One the business booked never waited
-- for anybody's answer, so it cannot be pending, declined or withdrawn.
ALTER TABLE job_request
    ADD COLUMN booked_by VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE job_request
    ALTER COLUMN booked_by DROP DEFAULT;
ALTER TABLE job_request
    ADD CONSTRAINT job_request_booked_by_known CHECK (booked_by IN ('CUSTOMER', 'BUSINESS'));
ALTER TABLE job_request
    ADD CONSTRAINT job_request_business_booking_never_asked CHECK (
        booked_by = 'CUSTOMER' OR status IN ('ACCEPTED', 'CANCELLED', 'COMPLETED'));
