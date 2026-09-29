-- How the customer would rather be reached about this job.
--
-- Nullable, and the null means "they did not say" rather than either answer. A
-- default would invent a preference nobody expressed, and the dashboard would
-- then show every older request as wanting a phone call.
--
-- On `job` and not on `job_request`: it is a property of the person and their
-- job, not of one business's copy of it. The same job sent to three
-- tradespeople is the same telephone number and the same wish about it.
ALTER TABLE job
    ADD COLUMN preferred_contact VARCHAR(16);

ALTER TABLE job
    ADD CONSTRAINT job_preferred_contact_known
        CHECK (preferred_contact IS NULL OR preferred_contact IN ('PHONE', 'EMAIL'));
