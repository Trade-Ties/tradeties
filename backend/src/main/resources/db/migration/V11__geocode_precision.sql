-- ---------------------------------------------------------------------------
-- How the point in latitude/longitude was arrived at.
--
-- The coordinates alone do not say that. A ZIP centroid and a rooftop geocode
-- are the same two numbers with the same column type, and they are worth
-- different amounts: one is the middle of a postal area, the other a building.
-- Recording which is which is what the geocoding trade does -- a provider
-- answers with a point AND the level it matched at -- and it is cheap to keep
-- now and impossible to reconstruct later.
--
-- Three things it buys, none of which need a second migration:
--   * a query for the profiles still sitting on a ZIP centroid, which is the
--     work list the day an address-level geocoder is added
--   * the ability to rank a rooftop hit above a ZIP hit rather than treating
--     both as exact
--   * an honest answer to "how sure are we", instead of six decimal places
--     that imply a precision the value does not have
--
-- Nullable, and paired with the coordinates by a constraint: a profile whose
-- address has not been geocoded has no point and no precision, and a point
-- without a precision would be a number nobody can weigh. The same pairing
-- V3 already applies to latitude/longitude, for the same reason.
--
-- The value set is a CHECK rather than a table. Unlike us_state or time_zone
-- this is not reference data the wizard offers -- it is an internal enum that
-- only ever changes when code changes, and the code and the constraint belong
-- in the same commit.
-- ---------------------------------------------------------------------------
ALTER TABLE business_profile
ADD COLUMN geocode_precision VARCHAR(16);

ALTER TABLE business_profile
ADD CONSTRAINT business_profile_precision_accompanies_coordinates CHECK (
    (latitude IS NULL) = (geocode_precision IS NULL)
);

ALTER TABLE business_profile
ADD CONSTRAINT business_profile_known_geocode_precision CHECK (
    geocode_precision IS NULL
    OR geocode_precision IN ('ZIP')
);

COMMENT ON COLUMN business_profile.geocode_precision IS
    'How the point was found. ZIP = centroid of the postal code.';
