-- ---------------------------------------------------------------------------
-- The job the customer picks, and the row a business hangs its offer on.
--
-- WHY THE FREE-TEXT MATCHER IS NOT ENOUGH, measured rather than assumed. V17
-- reads a sentence and ranks trades by a bag of about fifty words each. Against
-- descriptions written by somebody other than the person who wrote the
-- vocabulary, it ties Plumber against Painter on "there is a hole in the
-- bathtub" -- Painter carries "filling holes" -- and answers Painter alone, at
-- the bottom of the scale, for "convert my old lamp to LED", because no trade
-- has the word lamp and none has LED. Neither is fixable with more words: a bag
-- of words has no notion of which noun the sentence is about, and a vocabulary
-- is a closed set while the language customers arrive in is not.
--
-- So the input gets steered into a known list before anything is matched, which
-- is what Thumbtack, Angi and every catalogue-shaped marketplace does. This
-- table is that list. The matcher stays as the fallback for whoever types past
-- the end of it.
--
-- CURATED, NOT DERIVED FROM SUPPLY. The obvious shortcut is to build the list
-- out of business_service.name, since every business already writes what it
-- offers. It does not survive contact with the data. business_service is unique
-- per business on lower(name) and on nothing else (V3), so forty spellings of
-- "drain cleaning" are legal marketplace-wide; and the names are written in the
-- language a trade bills in, not the language a customer searches in -- of the
-- 74 in the development seed, around twenty are "Main line rooter service",
-- "Repipe assessment", "Fixture installation", "LVP installation". A list built
-- from those is a list no customer can read. Supply decides which entries are
-- worth showing in a given place; it does not decide what they are called.
--
-- THE ENTRY IS THE JOIN KEY, NOT THE TRADE, and that is the reason catalog_id
-- below carries no constraint tying it to business_service.trade_id. Two rows
-- in the seed say why. Montbello files "Boiler tune-up" under PLUMBER although
-- a boiler is HVAC work, because Plumber is the trade they lead with; and the
-- same thermostat job is filed under HVAC by one business and under
-- INSTALLATION_TECHNICIAN by another. If the catalogue's trade had to agree
-- with the business's, each of those pairs would lose a member. Search resolves
-- to an entry and joins through catalog_id to whoever offers it, whatever they
-- file it under themselves. trade_id here is for browsing and for giving the
-- free-text fallback a trade to answer with.
-- ---------------------------------------------------------------------------
CREATE TABLE
    service_catalog (
        id UUID NOT NULL,
        -- Identity, exactly as on `trade`: the seed in
        -- R__trade_service_catalog.sql upserts on this, so editing a code does
        -- not rename an entry -- it leaves the old row behind and inserts a
        -- second one.
        code VARCHAR(64) NOT NULL,
        trade_id UUID NOT NULL REFERENCES trade (id),
        -- What the customer reads in the dropdown. Verb-first where there is a
        -- verb: somebody searching has an intent, not a category.
        label VARCHAR(120) NOT NULL,
        -- What the typeahead matches on, carrying BOTH vocabularies on purpose
        -- -- the symptom words a customer types ("breaker keeps tripping") and
        -- the trade words a pro types ("rooter", "LVT", "tuckpointing"). One
        -- field therefore does two jobs: it finds the entry for a customer, and
        -- it suggests the right entry to a pro who typed their own wording.
        synonyms TEXT,
        -- Never DELETE: business_service rows point here. Retiring an entry is
        -- active = FALSE, which takes it out of the picker and leaves the links
        -- intact.
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL,
        PRIMARY KEY (id)
    );

CREATE UNIQUE INDEX service_catalog_by_code_uidx ON service_catalog (code);

-- One entry per customer job, enforced rather than hoped for. Two entries
-- reading the same in a dropdown is the failure this table exists to prevent,
-- and it is the shape a careless addition takes -- somebody adds "Install a
-- thermostat" for a second trade instead of letting both businesses link the
-- one that is already there.
CREATE UNIQUE INDEX service_catalog_by_label_uidx ON service_catalog (lower(label));

CREATE INDEX service_catalog_by_trade_idx ON service_catalog (trade_id);

-- NULLABLE, and it stays that way. A service written before this table existed
-- has no entry, and so does one whose wording matches nothing yet -- that is the
-- review queue that grows the catalogue, not an error state. Making it mandatory
-- would mean a pro cannot save a service the catalogue has not caught up with.
ALTER TABLE business_service
ADD COLUMN catalog_id UUID REFERENCES service_catalog (id);

-- The direction search actually reads: entry first, then who offers it.
CREATE INDEX business_service_by_catalog_idx ON business_service (catalog_id);

-- NO TYPEAHEAD INDEX HERE -- V19 adds it, and this paragraph is why it is a
-- second migration rather than a line below. Unlike V17's, it is not a decision
-- worth deferring against. V17 added an index ahead of its query because CREATE INDEX
-- holds a write lock for as long as it runs and a table is cheapest to index
-- before it fills. This table holds 72 rows and will hold a few hundred; the
-- index is instantaneous whenever it is added. Which index it should be is the
-- open question -- a typeahead wants prefix matching ("wash" -> "washing
-- machine"), which is trigram or a prefixed tsquery, not the stemmed full text
-- V17 uses -- and guessing now would mean guessing wrong cheaply instead of
-- choosing later for free.
