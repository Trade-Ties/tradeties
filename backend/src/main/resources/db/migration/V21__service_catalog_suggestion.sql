-- ---------------------------------------------------------------------------
-- What people ask for that the catalogue has no name for.
--
-- The 72 entries in R__trade_service_catalog.sql were derived from the 74
-- services in the development seed -- a reasoned guess by somebody who had
-- watched no customers at all. It shows: "Toilet is leaking" has no entry. The
-- nearest is "Replace a toilet", which is a different job, and that was found
-- by accident rather than by looking.
--
-- This table is how the looking stops being accidental. Two things write to it,
-- both without anybody deciding to:
--
--   PRO      -- a tradesperson typed a service name that matched no entry
--   CUSTOMER -- a customer searched a description the catalogue could not name
--
-- The count is the point. A single typo stays at one and sinks; eighteen people
-- describing the same missing job rise to the top of the list and answer "what
-- are we missing" without anybody guessing.
--
-- NOT A QUEUE YET, DELIBERATELY. There is no status column and no link to a
-- promoted entry, because nothing promotes anything: there is no operation and
-- no screen. Adding the state a workflow needs before the workflow exists is
-- how a column ends up meaning whatever the first person to use it assumed.
-- They arrive with the promote operation, in their own migration.
--
-- NO POSTAL CODE, and the omission is the interesting one. It is tempting --
-- "40 people in 80202 asked for this" reads well. But this table answers a
-- question about VOCABULARY, and a missing job name is missing everywhere;
-- keying the count by location would split one signal across forty rows of one
-- and destroy the only thing the count is good for. Where demand goes unserved
-- is a different question -- about supply, for a job the catalogue already names
-- -- and it deserves its own shape rather than a column here that half means it.
-- ---------------------------------------------------------------------------
CREATE TABLE
    service_catalog_suggestion (
        id UUID NOT NULL,
        -- Which side said it. The two are counted separately on purpose: a
        -- tradesperson naming work they do and a customer naming work they want
        -- are different evidence, and a phrase only one side ever uses is worth
        -- knowing about as such.
        source VARCHAR(16) NOT NULL,
        -- As typed, after trimming and collapsing runs of whitespace. Normalised
        -- that far and no further: lowercasing it here would throw away how
        -- people actually write, which is exactly what somebody reading this
        -- table is trying to learn.
        phrase VARCHAR(300) NOT NULL,
        seen_count INTEGER NOT NULL,
        first_seen_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            last_seen_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            PRIMARY KEY (id),
            CHECK (source IN ('PRO', 'CUSTOMER')),
            CHECK (seen_count > 0)
    );

-- Case-insensitive, because "leaking toilet" and "Leaking toilet" are one
-- phrase to everybody except a byte comparison -- the same reasoning V3 applies
-- to service names. This index is also what the upsert keys on, so it is what
-- turns a second sighting into a count rather than a second row.
CREATE UNIQUE INDEX service_catalog_suggestion_phrase_uidx ON service_catalog_suggestion (source, lower(phrase));

-- The one question this table is read for: what is asked for most and still has
-- no name. Ordered rather than filtered, because "most" is the whole query.
CREATE INDEX service_catalog_suggestion_by_count_idx ON service_catalog_suggestion (source, seen_count DESC);
