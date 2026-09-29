-- Whether an entry was taken as whole days or as a stretch of hours.
--
-- Stored rather than read off the instants: "midnight to midnight" is only
-- recognisable in the zone it was entered in, and a business that changes its
-- zone would see its holiday turn into a stretch from one in the morning.
--
-- The default is for rows written before this column, all of which were
-- inserted by hand as stretches of hours. The application always sets it.
ALTER TABLE availability_time_off
    ADD COLUMN all_day BOOLEAN NOT NULL DEFAULT FALSE;
