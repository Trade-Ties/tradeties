-- ---------------------------------------------------------------------------
-- Turning "Kitchen sink is leaking under the cabinet" into a trade.
--
-- The customer never picks one. The landing page asks for the problem and
-- nothing else, deliberately -- so the trade has to be read out of a sentence
-- somebody typed, and this is the vocabulary that reads it.
--
-- WORDS, NOT LETTERS, AND THAT WAS NOT THE FIRST GUESS. The plan for this said
-- pg_trgm, which compares three-letter groups. Measured against the phrasing
-- below, a plumbing problem ranked Painter first -- "paint" shares letters with
-- "cabinet" and "kitchen". Trigrams answer "is this spelled nearly the same",
-- which is the wrong question here and exactly the right one for a business
-- name typed with a typo, so pg_trgm arrives too, on a different column.
--
-- Full text stems both sides before comparing: leaking, leaks and leaked all
-- become "leak", so the customer's wording does not have to match the seed
-- phrasing. Stop words drop out.
--
-- ANY WORD, NOT ALL OF THEM. plainto_tsquery joins terms with AND, which is the
-- trap this function exists for: "kitchen & sink & leak & cabinet" is satisfied
-- by no trade at all, and the first version of this scored every row zero.
-- Rewriting the operator makes it "any of these", which is the question being
-- asked -- a description is a handful of clues, not a specification.
--
-- IMMUTABLE, because the generated column below cannot use anything else, and
-- STRICT so a null description is a null query rather than an error. Empty or
-- stop-words-only input answers NULL too, and `@@ NULL` matches nothing --
-- which is the honest answer to "find me a trade for 'the'".
--
-- to_tsvector is called with an explicit 'english', not the one-argument form.
-- The short form reads default_text_search_config at runtime and is therefore
-- only STABLE, which a generated column rejects. Naming the configuration also
-- pins it: the stored vector cannot change meaning because a server setting
-- did.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION any_word (input TEXT) RETURNS TSQUERY LANGUAGE SQL IMMUTABLE STRICT AS $$
SELECT
    nullif(replace(plainto_tsquery('english', input)::TEXT, '&', '|'), '')::TSQUERY
$$;

COMMENT ON FUNCTION any_word (TEXT) IS
    'A search phrase as "any of these words". Null for input that carries none.';

-- The vocabulary a trade is recognised by, seeded in R__trade_search_terms.sql
-- rather than beside the catalogue: which trades exist is a decision about the
-- marketplace, how they are described is editorial work on a different rhythm,
-- and separating them keeps a phrasing tweak out of the file that owns identity.
--
-- Nullable, because six of the sixteen have no phrasing yet and a trade with
-- none is still findable by its own name -- worse, not broken.
ALTER TABLE trade
ADD COLUMN search_terms TEXT;

ALTER TABLE trade
ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', display_name || ' ' || coalesce(search_terms, ''))
) STORED;

CREATE INDEX trade_search_idx ON trade USING GIN (search_vector);

-- NOTHING READS THIS YET, AND THAT IS DELIBERATE. The other half of the search
-- box -- a customer who knows the name -- is the next slice. No query, no
-- parameter and no screen reaches this index today, and a reader who assumed
-- otherwise would go looking for the caller that closes the loop.
--
-- It lands here rather than with its query for two reasons. It rides along with
-- the migration that already creates pg_trgm and already touches this table, so
-- the alternative is a second migration doing both again. And an index is
-- cheapest to add before the table fills: on a populated one CREATE INDEX holds
-- a write lock for as long as it runs, and the way around that -- CONCURRENTLY
-- -- cannot run inside a transaction, which is what Flyway wraps a migration in
-- unless it is told otherwise.
--
-- Trigrams and not full text, because "Joes Plumbin" is a spelling question --
-- stemming would not save it and letter groups do.
--
-- Partial on PUBLISHED, like every other index on this table: a draft is
-- offered to nobody.
CREATE INDEX business_profile_display_name_trgm_idx ON business_profile USING GIN (
    display_name gin_trgm_ops
)
WHERE
    status = 'PUBLISHED';
