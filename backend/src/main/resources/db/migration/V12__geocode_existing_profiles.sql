-- ---------------------------------------------------------------------------
-- The profiles that were saved before there was anything to geocode with.
--
-- V10 and V11 gave the schema a place to put a point; BusinessService fills it
-- on every write from here on. Neither does anything for a profile that is
-- already stored and is never edited again -- it keeps NULL coordinates, and a
-- profile with no coordinates appears in no radius search. Nothing about it
-- looks wrong: the tradesperson filled in every field, the profile is live, and
-- no customer ever finds it.
--
-- So the same lookup BusinessService does on a write is done once here for
-- everything already in the table. Four things about how:
--
--   * LEFT(postal_code, 5) because the column holds ZIP or ZIP+4 and
--     zip_centroid is keyed on the five. The same trim ZipCentroidGeocoder
--     makes, and leaving it out would silently skip every ZIP+4 profile --
--     which is the half of them that looks most carefully filled in.
--   * latitude IS NULL, so this only ever adds. A profile that has already
--     been written since V11 keeps the point it has, and a later, sharper
--     geocode is not undone by a migration that reruns nowhere.
--   * geocode_precision set in the same statement, because the constraint in
--     V11 pairs them and because ZIP is the honest answer for what this did.
--   * A ZIP that zip_centroid does not carry leaves the row untouched and NULL,
--     exactly as a write would. The readiness check is where that is caught,
--     at the door such a profile would go live through -- not here, where the
--     only options would be to guess or to fail the deployment.
--
-- updated_at is deliberately not touched. It records when the tradesperson
-- last changed their profile, and this is not that: bumping it would tell every
-- one of them that somebody edited their profile on the day this deployed.
-- `version` for the same reason -- it guards a client's read against a
-- concurrent write, and there is no conflict to report here. Any save that
-- follows recomputes these columns from the address anyway.
-- ---------------------------------------------------------------------------
UPDATE business_profile p
SET
    latitude = z.latitude,
    longitude = z.longitude,
    geocode_precision = 'ZIP'
FROM zip_centroid z
WHERE
    z.zip = LEFT(p.postal_code, 5)
    AND p.latitude IS NULL;
