-- ---------------------------------------------------------------------------
-- When the profile URL stopped being editable.
--
-- The slug is the one column on business_profile that is not really the
-- holder's data. It is `tradeties.com/pro/{slug}` -- printed on a van, on
-- invoices, read out over the phone, indexed by a search engine. None of those
-- copies can be corrected from here, so once the first one exists the value has
-- to stand still. Before publication no copy can exist, because a DRAFT is not
-- searchable, which is why the freeze starts there and not at creation.
--
-- A timestamp rather than a boolean. It costs the same, it is the honest record
-- of an event that happened once, and the column also answers "how long has
-- this business been live" without a second migration. The rule reads it as a
-- null check and nothing more.
--
-- NOT derived from status. Unpublishing puts the profile back to DRAFT (see
-- the unpublish endpoint), so a business that was live for a year and went
-- offline last week is indistinguishable from one that never published --
-- exactly the case where the slug must stay locked.
--
-- The rule has two halves, and only one of them is a constraint.
--
-- "A published slug does not change" compares the new value against the old
-- one, which is a statement about a transition rather than about a row, so no
-- CHECK can express it. BusinessProfile.apply holds that half, on the write
-- itself, where it answers 409 with a sentence a person can read.
--
-- "A published profile has a first_published_at" is a statement about one row,
-- and it is the assumption the other half rests on: nothing in Java sets
-- SUSPENDED, so this table's status is already moved by hand-written SQL, and
-- one UPDATE that switches a profile back on without stamping this column
-- leaves a live, indexed business with a freely editable URL and no symptom.
-- That one is a CHECK, below.
--
-- No alias or redirect table yet, deliberately. That is the additive half of
-- this decision and can be built the day a real rename turns up: a table of
-- retired slugs, a 301 in front of the public profile, and slug-available
-- consulting both. Building it now would mean carrying a namespace that grows
-- forever for a case that has not happened once. Freezing first is what keeps
-- that door open -- the reverse order hands out broken links before the rule
-- arrives.
-- ---------------------------------------------------------------------------
ALTER TABLE business_profile
ADD COLUMN first_published_at TIMESTAMP(6)
WITH
    TIME ZONE;

-- The rows whose address is already out in the world, on the two pieces of
-- evidence this table actually holds that one is.
--
-- PUBLISHED is live right now, so it is certainly out. And
-- onboarding_completed_step reaches 9 only in BusinessProfile.publish() and
-- never moves back -- advisory for the wizard, but a reliable record of the
-- fact that publishing once succeeded, which is the whole question here. It
-- covers the unpublished-but-once-published rows the status no longer names,
-- and the suspended ones that were live before they were switched off.
--
-- SUSPENDED on its own is deliberately NOT evidence. It reads as "the
-- marketplace switched this off", which sounds like it must first have been on
-- -- but nothing in Java sets it, so it is applied by hand-written SQL and can
-- land on a draft that never published. PublishTests does exactly that. Reading
-- it as published would freeze the URL of a profile no customer has ever seen,
-- with the field permanently read-only and no way back.
--
-- updated_at is the closest thing to the moment it happened that this table has
-- kept; the rule only asks whether the column is null, so an approximate
-- timestamp locks the slug just as firmly as an exact one would.
UPDATE business_profile
SET
    first_published_at = updated_at
WHERE
    first_published_at IS NULL
    AND (
        status = 'PUBLISHED'
        OR onboarding_completed_step = 9
    );

-- The row-local half of the rule, which the backfill above has just made true
-- of every existing row. publish() sets both fields together, so nothing in the
-- application can trip this; what it is here for is a hand-written UPDATE, where
-- the alternative to a constraint violation is a live profile whose URL is still
-- editable and nothing saying so.
ALTER TABLE business_profile
ADD CONSTRAINT business_profile_published_has_first_published_at CHECK (
    status <> 'PUBLISHED'
    OR first_published_at IS NOT NULL
);
