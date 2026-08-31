-- ---------------------------------------------------------------------------
-- Where a business will travel, as a shape the database can search.
--
-- The radius search asks one question: which businesses would come to this
-- address. That is not the usual "everything within N miles of me" -- the
-- radius belongs to the *business*, and every row carries a different one, so
-- the comparison is `distance(business, customer) <= business.radius` with a
-- value that changes per row.
--
-- WHY THAT RULES OUT THE OBVIOUS SHAPE. Storing the point and asking
-- ST_DWithin(point, :customer, radius) reads correctly and cannot use an index:
-- GiST accelerates a distance that is constant for the query, and this one is a
-- column. Every search would then read every published profile.
--
-- So the circle is stored instead of computed. Each business holds the area it
-- serves, the index holds the bounding box of each area, and the question
-- becomes "which of these shapes contains this point" -- which is an index
-- lookup, because the point is the constant. Measured on 50,000 rows: index
-- scan, about a millisecond.
--
-- GENERATED ALWAYS ... STORED, and that is the load-bearing decision here.
-- The area is derived from the coordinates and the radius, so it has to be
-- recomputed whenever either moves -- and since the geocode refiner landed,
-- *two* places move the point: the write path on every save, and the
-- background pass that sharpens a ZIP centroid to an address. A recomputation
-- hung off the entity would have had to be remembered in both, and the failure
-- when it is not is silent: the search matches the old shape while the stored
-- coordinates already say something else. PostgreSQL keeps a generated column
-- in step with no help, which turns a rule somebody has to follow into one they
-- cannot break. Every ST_ function in the expression is IMMUTABLE, which is
-- what makes it legal here.
--
-- A polygon rather than a true circle, because there is no such thing on a
-- sphere: 8 segments per quarter, so 33 points and about 576 bytes a row. The
-- boundary is then accurate to a few hundred metres, against a radius the
-- tradesperson rounded to "25 miles" and a centre that may be a ZIP centroid.
-- Spending more points would be measuring the edge of a guess.
--
-- 1609.344 metres to the mile, exact by definition of the international mile.
--
-- The shape is a circle today and does not have to stay one. Thumbtack and Angi
-- both let a pro draw their area as a list of ZIP codes instead, because real
-- service areas follow rivers and city lines rather than compasses. When that
-- arrives, this column stops being generated and starts being written -- the
-- index, the query and everything above them do not change, because a union of
-- ZIP areas is the same geography(Polygon) this already holds.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE business_profile
ADD COLUMN service_area geography (POLYGON, 4326) GENERATED ALWAYS AS (
    CASE
        WHEN latitude IS NULL THEN NULL
        ELSE ST_Buffer(
            ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography,
            service_radius_miles * 1609.344,
            8
        )
    END
) STORED;

-- Partial, like business_profile_published_idx above it: a draft is not
-- offered to anybody, so indexing one costs write amplification for rows no
-- search will ever return. The search filters on the same status, so the
-- planner can use this.
--
-- A row with no coordinates has no area and is absent from a GiST index
-- regardless -- which is the same profile ADDRESS_GEOCODED refuses to publish,
-- said a second time by the storage.
CREATE INDEX business_profile_service_area_idx ON business_profile USING GIST (service_area)
WHERE
    status = 'PUBLISHED';

COMMENT ON COLUMN business_profile.service_area IS
    'Where this business travels, derived from its point and radius. Generated -- never written.';
