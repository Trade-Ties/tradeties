-- ---------------------------------------------------------------------------
-- The point every US ZIP code resolves to.
--
-- The table that turns an address into something the search can compute with.
-- A business stores a postal code; a customer types one into the search box;
-- both sides need the same two numbers, and this is where they come from.
--
-- Created here, seeded in R__zip_centroid.sql -- the same split `trade` uses
-- (table in V3, rows in a repeatable file), for the same reason: the rows come
-- from an outside dataset that gets a new vintage every year, and re-seeding
-- them should not need a new numbered file.
--
-- NO city and NO state column, deliberately. The Census gazetteer this is
-- seeded from carries neither, so filling them would mean a second dataset
-- joined onto this one -- two sources that can disagree about where a ZIP is.
-- `us_state` stays the single place that decides which states a business may
-- operate in, and this table answers exactly one question: where is this ZIP.
--
-- Coordinates are NOT NULL here although business_profile allows them to be
-- absent. There they mean "not geocoded yet"; a row here with no point would
-- be a ZIP that answers the lookup with nothing, which is what leaving it out
-- of the table already says.
--
-- The CHECKs are the same globe-wide bounds business_profile uses, not the
-- tighter box the 50 states actually occupy. A constraint that encoded the
-- current market would have to be migrated the day a territory is added; the
-- test asserts the tighter box instead, where a surprise is a failing build
-- rather than a rejected INSERT.
-- ---------------------------------------------------------------------------
CREATE TABLE
    zip_centroid (
        zip CHAR(5) NOT NULL,
        latitude NUMERIC(9, 6) NOT NULL,
        longitude NUMERIC(9, 6) NOT NULL,
        PRIMARY KEY (zip),
        CHECK (zip ~ '^[0-9]{5}$'),
        CHECK (latitude BETWEEN -90 AND 90),
        CHECK (longitude BETWEEN -180 AND 180)
    );

COMMENT ON TABLE zip_centroid IS 'Census ZCTA centroids. Generated -- see R__zip_centroid.sql.';
