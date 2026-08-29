-- ---------------------------------------------------------------------------
-- The profiles that were saved before there was anything to geocode with.
--
-- BusinessService fills the point on every write from here on. That does
-- nothing for a profile already stored and never edited again: it keeps NULL
-- coordinates, appears in no radius search, and nothing about it looks wrong
-- -- the tradesperson filled in every field and no customer ever finds them.
--
-- REPEATABLE RATHER THAN NUMBERED, AND THAT IS THE POINT OF THE FILE. This
-- reads zip_centroid, which R__zip_centroid.sql seeds, and Flyway runs every
-- repeatable migration after all versioned ones. A numbered file joined an
-- empty table and updated nothing on exactly the deployment that had profiles
-- to catch up -- silently, and invisibly to CI, which starts from a database
-- with no rows to backfill.
--
-- V12 IS THAT NUMBERED FILE, AND IT STAYS WHERE IT IS. It has already been
-- applied wherever this schema exists, so removing it -- or editing so much as
-- a comment in it, which changes its checksum -- makes Flyway refuse to start
-- against every one of those databases. It ran, it matched nothing, and it is
-- inert. Leave it; this file is the one that does the work.
--
-- Repeatables run among themselves in order of description, and `zip_centroid`
-- sorts before `zip_centroid_backfill` because it is a prefix of it. Renaming
-- either half breaks the ordering; GeocodeBackfillTests pins it.
--
--   * LEFT(postal_code, 5) because the column holds ZIP or ZIP+4 and
--     zip_centroid is keyed on the five. The same trim ZipCentroidGeocoder
--     makes, and leaving it out would silently skip every ZIP+4 profile --
--     which is the half of them that looks most carefully filled in.
--   * latitude IS NULL, so this only ever adds. A profile written since V11
--     keeps the point it has, and a later, sharper geocode is not undone by a
--     rerun of this file.
--   * geocode_precision set in the same statement, because the constraint in
--     V11 pairs them and because ZIP is the honest answer for what this did.
--   * A ZIP that zip_centroid does not carry leaves the row untouched and
--     NULL. GeocodeRefiner takes those to an address-level service, and
--     ADDRESS_GEOCODED holds the profile back until one of the two answers.
--
-- updated_at is deliberately not touched. It records when the tradesperson
-- last changed their profile, and this is not that: bumping it would tell
-- every one of them that somebody edited their profile on the day this
-- deployed. `version` for the same reason -- it guards a client's read against
-- a concurrent write, and there is no conflict to report here.
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
