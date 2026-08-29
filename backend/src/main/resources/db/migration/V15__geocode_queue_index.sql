-- ---------------------------------------------------------------------------
-- The index the background geocode pass reads its work list through.
--
-- GeocodeRefiner runs every five minutes, forever. Its query filters on
-- geocode_precision and orders by geocode_attempted_at, and neither column was
-- indexed -- so every pass read the whole of business_profile and sorted it to
-- return twenty-five rows. Including the passes with nothing to do, which is
-- most of them once the queue has drained: the cost does not go away when the
-- work does.
--
-- PARTIAL, on the same condition the queue uses. A profile sharpened to STREET
-- leaves the index instead of sitting in it, so the index is the outstanding
-- work rather than a copy of the table, and it shrinks as that work is done.
-- The NULL half is in it for the same reason it is in the queue: a postal code
-- that resolved to nothing is the case only the address-level service can fix.
--
-- NULLS FIRST IS NOT DECORATION. The query orders `geocode_attempted_at ASC
-- NULLS FIRST`, so that a profile never asked about goes before one being
-- retried -- and the default for ASC is NULLS LAST. An index built the default
-- way cannot supply that order: the planner would read it and then sort the
-- rows anyway, and the index would only have looked like it helped. The test
-- asserts the plan has no sort in it, which is the part that would rot
-- silently.
--
-- Under exactly this order the rows the pass wants come first -- never
-- attempted, then longest ago -- so the scan stops after the batch rather than
-- reading to the end.
--
-- A plain CREATE INDEX takes a write lock for as long as it takes to build.
-- That is nothing on this table today; the day it is not, CONCURRENTLY is the
-- answer and needs its own migration outside a transaction.
-- ---------------------------------------------------------------------------
CREATE INDEX business_profile_awaiting_geocode_idx ON business_profile (geocode_attempted_at ASC NULLS FIRST)
WHERE
    geocode_precision IS NULL
    OR geocode_precision = 'ZIP';
