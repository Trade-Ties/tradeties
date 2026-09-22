-- ---------------------------------------------------------------------------
-- Counting how much of the customer's sentence an answer actually accounts for.
--
-- Both searches were ranking by score and cutting by a fraction of the best one.
-- Measured against sentences nobody wrote the vocabulary for, that fraction is
-- the wrong instrument. "Toilet is leaking" scored Plumber 1.000 and Roofer
-- 0.500 -- Roofer carries "roof leak" and "gutters leaking", so it matched the
-- word `leak` and nothing else. At 0.500 it survived a 0.45 cut. Meanwhile
-- "water is coming through the ceiling" scored Painter 0.750 on two matched
-- words, which is a fair answer. One number could not separate them.
--
-- The word count could, and cleanly: across every description measured, each
-- wrong trade had matched exactly ONE word and each right one more. So the
-- question stops being "did it score well enough" and becomes "how much of what
-- they wrote does it account for", which is what the functions below answer.
--
-- IMMUTABLE and STRICT throughout, like any_word in V17: null input is a null
-- answer rather than an error, and a stable result is what lets these be called
-- from a WHERE clause without PostgreSQL re-planning around them.
-- ---------------------------------------------------------------------------
-- HOW MANY OF THE DESCRIPTION'S WORDS THIS TRADE KNOWS.
--
-- Both sides are stemmed 'english' before comparing, so "leaking" in the
-- sentence and "leak" in the vocabulary are one word rather than two -- the same
-- reason V17 chose full text over trigrams. Stop words never reach either side,
-- so "is" and "the" cannot inflate the count.
--
-- INTERSECT rather than a join: it deduplicates on both sides at once, which is
-- what makes this a count of WORDS and not of occurrences. A trade whose
-- vocabulary repeats "water" three times has said one word about it, and the
-- repetition is already paid for in ts_rank.
CREATE FUNCTION words_matched (v TSVECTOR, input TEXT) RETURNS INT LANGUAGE SQL IMMUTABLE STRICT AS $$
SELECT
    cardinality(ARRAY(
        SELECT unnest(tsvector_to_array(to_tsvector('english', input)))
        INTERSECT
        SELECT unnest(tsvector_to_array(v))
    ))
$$;

COMMENT ON FUNCTION words_matched (TSVECTOR, TEXT) IS
    'How many distinct words of a description this vocabulary accounts for.';

-- THE TYPEAHEAD'S QUERY, AND THE OPERATOR IS THE WHOLE CHANGE.
--
-- V19 built the same prefixes with AND, which asked every typed word to match.
-- One filler word was enough to empty the list: "Toilet is leaking" became
-- 'is':* & 'leaking':* & 'toilet':* and matched nothing, because no entry
-- contains a word beginning "is". Every customer who types a sentence rather
-- than keywords hit that, and an empty dropdown does not look like a bug.
--
-- A STOP-WORD LIST WAS THE OBVIOUS FIX AND IS NOT THE ONE, for two measured
-- reasons. The catalogue's own text contains "is", "my" and "the" -- "water is
-- running now", "my list", "Replace the roof" -- so its vocabulary cannot serve
-- as the list. And a hand-written list only ever catches the words somebody
-- thought of: "urgent toilet leaking" would still have come back empty.
--
-- OR costs nothing here because the ranking does the work instead. A word that
-- fits nothing contributes nothing, whether it is "is" or "urgently" or a typo,
-- and no list has to know about it in advance.
CREATE FUNCTION any_prefix (input TEXT) RETURNS TSQUERY LANGUAGE SQL IMMUTABLE STRICT AS $$
SELECT
    to_tsquery('simple', string_agg(quote_literal(lexeme) || ':*', ' | ' ORDER BY lexeme))
FROM
    unnest(tsvector_to_array(to_tsvector('simple', input))) AS lexeme
$$;

COMMENT ON FUNCTION any_prefix (TEXT) IS
    'A part-typed phrase as "any word begins like one of these". Null for input carrying none.';

-- HOW MANY OF THE TYPED WORDS THIS ENTRY BEGINS ONE OF.
--
-- The counterpart to words_matched on the other side of the search, and it
-- cannot share an implementation with it: this one compares 'simple' lexemes as
-- prefixes, that one compares stemmed 'english' lexemes whole. Same question,
-- two different notions of "the same word", which is exactly the split V19 drew
-- between reading a finished sentence and reading an unfinished one.
CREATE FUNCTION prefixes_matched (v TSVECTOR, input TEXT) RETURNS INT LANGUAGE SQL IMMUTABLE STRICT AS $$
SELECT
    count(*)::INT
FROM
    unnest(tsvector_to_array(to_tsvector('simple', input))) AS lexeme
WHERE
    v @@ to_tsquery('simple', quote_literal(lexeme) || ':*')
$$;

COMMENT ON FUNCTION prefixes_matched (TSVECTOR, TEXT) IS
    'How many of the typed words this vocabulary begins one of.';

-- The denominator: how many words were typed at all.
--
-- Needed because the floor is a share rather than a count. Somebody typing one
-- word must not be asked to match two, and somebody typing "is my the" must not
-- be answered with whatever happens to contain a word starting "is" -- three
-- words in, one match is not an answer.
--
-- coalesce because array_length of an empty array is null, not zero.
CREATE FUNCTION words_typed (input TEXT) RETURNS INT LANGUAGE SQL IMMUTABLE STRICT AS $$
SELECT
    coalesce(array_length(tsvector_to_array(to_tsvector('simple', input)), 1), 0)
$$;

COMMENT ON FUNCTION words_typed (TEXT) IS
    'How many searchable words a part-typed phrase carries.';

-- V19's AND-ing query builder, now unreferenced. Dropped rather than left
-- behind: the two differ by one character in their bodies and by everything in
-- their behaviour, and a reader who picked the wrong one would get a search box
-- that empties on the word "is" with nothing to explain why.
DROP FUNCTION prefix_words (TEXT);
