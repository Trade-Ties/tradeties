-- The overlap check on accepted appointments, made deferrable.
--
-- Rearranging a calendar moves several appointments in one transaction, and
-- the rows are updated one at a time: two appointments swapping their times
-- overlap after the first update and not after the second. Checked per
-- statement, a valid end state fails halfway there.
--
-- INITIALLY IMMEDIATE, so every other write keeps its precise, per-statement
-- refusal. Only the transaction that rearranges defers it, and it checks the end
-- state itself under the calendar lock before writing — the constraint stays the
-- last word at commit.
ALTER TABLE job_request
    DROP CONSTRAINT job_request_no_overlapping_appointments;

ALTER TABLE job_request
    ADD CONSTRAINT job_request_no_overlapping_appointments
        EXCLUDE USING gist (business_id WITH =,
                            tstzrange(starts_at, ends_at, '[)') WITH &&)
        WHERE (status = 'ACCEPTED')
        DEFERRABLE INITIALLY IMMEDIATE;
