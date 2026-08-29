-- ---------------------------------------------------------------------------
-- When the sharper geocoder last looked at this profile.
--
-- Without it the background pass has no memory, and `geocode_precision = 'ZIP'`
-- means two things it cannot tell apart: not tried yet, and tried and there is
-- no better answer. Rural routes, new construction and PO boxes are the second
-- kind permanently -- so every pass would ask about them again, forever, and
-- the queue would never drain below them.
--
-- A timestamp rather than a "tried" flag, for the reason V6 gave when it chose
-- first_published_at over a boolean: it costs the same and answers "when",
-- which is the question a retry needs. The pass skips what it looked at
-- recently, so a service that was down is picked up again on its own and an
-- address that will never match is asked about a few times a year.
--
-- Deliberately NOT paired with the coordinates the way geocode_precision is.
-- It records an attempt, not a result: a profile that was asked about and got
-- nothing has this set and no better point, and that combination is the whole
-- reason the column exists.
--
-- Null on every existing row, which reads as "never looked at" and is true.
-- ---------------------------------------------------------------------------
ALTER TABLE business_profile
ADD COLUMN geocode_attempted_at TIMESTAMP(6) WITH TIME ZONE;

COMMENT ON COLUMN business_profile.geocode_attempted_at IS
    'When the address-level geocoder last tried this profile, whether or not it found anything.';
