-- ---------------------------------------------------------------------------
-- Turning half a typed word into the job the customer means.
--
-- V18 left this index out and said which question had to be answered first:
-- a typeahead wants prefix matching, and the stemmed full text V17 uses is the
-- wrong tool for it. This is that answer.
--
-- 'simple', NOT 'english', AND STEMMING IS EXACTLY WHY. The English
-- configuration reduces "washing" to the lexeme "wash". A customer four letters
-- in has typed "wash", five in "washi" -- and `washi:*` matches nothing at all
-- against a stored "wash", so the suggestion list would fill up at four
-- characters and empty at five. The simple configuration stores words as they
-- are written, so a prefix of the word the customer is typing is a prefix of the
-- word that is stored.
--
-- It drops the stop words too, which matters more here than it looks. "No hot
-- water" is one of the most-typed openings there is, and under 'english' the
-- word "no" is not searchable at all -- the first two characters of the sentence
-- would match nothing.
--
-- WHAT 'simple' COSTS: the singular and the plural stop being the same word.
-- Typing "drain" still finds "drains" because the query is a prefix; typing
-- "drains" no longer finds "drain". That is the right way round -- somebody
-- mid-word types less than the word, not more -- and it is the reason the
-- synonyms in R__trade_service_catalog.sql are written the way people type
-- rather than in one canonical form.
--
-- EVERY TOKEN IS A PREFIX, not just the last one. "wat hea" has to find "water
-- heater", and which of the two words the customer is still typing is not
-- knowable from the string -- they may have paused anywhere. ANDing prefixes is
-- also what makes the list narrow as they keep typing, which is the whole
-- behaviour being bought.
-- ---------------------------------------------------------------------------
-- The companion to any_word in V17, and the contrast between them is the point:
-- that one asks "any of these words, as meanings", this one asks "all of these
-- word-beginnings, as letters".
--
-- BUILT BY POSTGRESQL FROM THE INPUT RATHER THAN BY THE CALLER, which is what
-- makes it safe to hand a raw search box to. to_tsquery parses its argument as
-- an expression language -- &, |, !, parentheses -- so passing typed text
-- straight in is both an injection surface and a syntax error waiting for the
-- first customer who types "AT&T". Running the input through to_tsvector first
-- reduces it to lexemes, and only those are assembled.
--
-- quote_literal around each one, because a lexeme is not guaranteed to be a bare
-- word: the parser recognises hosts and paths, so "example.com/x" survives as a
-- single lexeme and would be a syntax error unquoted.
--
-- ORDER BY inside the aggregate for determinism, which IMMUTABLE promises and
-- string_agg over unnest does not otherwise give. The terms are ANDed, so the
-- order cannot change what matches -- only whether the same input reliably
-- produces the same query, which is what lets this be called from a generated
-- column or an index expression later.
--
-- STRICT, and empty input answers NULL rather than an error: `@@ NULL` matches
-- nothing, which is the honest answer to a search box containing a space.
CREATE FUNCTION prefix_words (input TEXT) RETURNS TSQUERY LANGUAGE SQL IMMUTABLE STRICT AS $$
SELECT
    to_tsquery('simple', string_agg(quote_literal(lexeme) || ':*', ' & ' ORDER BY lexeme))
FROM
    unnest(tsvector_to_array(to_tsvector('simple', input))) AS lexeme
$$;

COMMENT ON FUNCTION prefix_words (TEXT) IS
    'A part-typed phrase as "every word begins like this". Null for input carrying no word.';

-- WEIGHTED, so that a hit on the label outranks a hit on the synonyms. Both are
-- searchable and both should be -- somebody typing "rooter" has to reach "Clear
-- a blocked main sewer line", and that word appears nowhere in the label -- but
-- when a word is in both, the entry whose NAME contains it is the better
-- suggestion. ts_rank's default weights make A four times B, which is enough
-- separation without a hand-tuned score.
ALTER TABLE service_catalog
ADD COLUMN suggest_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', label), 'A') || setweight(to_tsvector('simple', coalesce(synonyms, '')), 'B')
) STORED;

-- Added now rather than deferred, which is the opposite of what V18 decided and
-- for the reason V18 gave: the table holds 72 rows, so the write lock CREATE
-- INDEX takes is measured in milliseconds whenever it is taken. What was worth
-- waiting for was knowing which index; that is settled above.
CREATE INDEX service_catalog_suggest_idx ON service_catalog USING GIN (suggest_vector);
