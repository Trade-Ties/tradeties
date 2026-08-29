-- ---------------------------------------------------------------------------
-- The second thing a point can be.
--
-- V11 allowed one value, ZIP, because one was all the code could produce. The
-- Census geocoder answers at address-range level -- it interpolates along a
-- street segment between the house numbers TIGER holds for it -- which is a
-- different and better answer, and saying so is the entire purpose of the
-- column.
--
-- STREET rather than ROOFTOP, and the distinction is not pedantry. A rooftop
-- geocode is the building; this is a position along a block, derived from
-- where the numbering starts and ends. Usually within a house or two, and not
-- the same claim. Calling it ROOFTOP would overstate it in exactly the way the
-- geocoding trade warns about, and the name is what a later reader believes.
--
-- Dropping and recreating the constraint, because PostgreSQL has no ALTER for
-- the body of a CHECK. Nothing is rewritten: every stored row says ZIP, which
-- the new constraint still allows, so the validation scan finds no violation.
-- ---------------------------------------------------------------------------
ALTER TABLE business_profile
DROP CONSTRAINT business_profile_known_geocode_precision;

ALTER TABLE business_profile
ADD CONSTRAINT business_profile_known_geocode_precision CHECK (
    geocode_precision IS NULL
    OR geocode_precision IN ('ZIP', 'STREET')
);

COMMENT ON COLUMN business_profile.geocode_precision IS
    'How the point was found. ZIP = centroid of the postal code; STREET = interpolated along the address range.';
