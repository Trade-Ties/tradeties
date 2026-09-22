-- ---------------------------------------------------------------------------
-- Turning a collected phrase into a job the marketplace has a name for.
--
-- V21 said these two columns would arrive with the operation that writes them,
-- and this is it. Until now the table only counted: somebody could read it with
-- SQL and then had no way forward except editing the seed file and deploying,
-- which is the one thing the whole arrangement exists to avoid.
--
-- WHY A STATUS AND NOT A DELETE. A promoted phrase is the record of where a
-- catalogue entry came from, and a dismissed one is the record of a decision
-- somebody already made -- deleting either loses the only thing that stops the
-- same judgement being made twice. It also keeps the counting honest: the feed
-- goes on counting whatever it sees, and a dismissed phrase that quietly climbs
-- to four hundred is worth somebody looking at again.
--
-- WHAT THE COUNTER DOES AFTER A DECISION, because it surprises on first
-- reading. A PROMOTED phrase stops arriving on its own: the customer feed only
-- records what the catalogue cannot name, and after promotion it can. A
-- DISMISSED one keeps counting, silently, and that is deliberate -- see above.
-- Neither changes status by itself. A human decision is not undone by traffic.
-- ---------------------------------------------------------------------------
ALTER TABLE service_catalog_suggestion
ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'NEW';

ALTER TABLE service_catalog_suggestion
ADD CONSTRAINT service_catalog_suggestion_status_check CHECK (status IN ('NEW', 'PROMOTED', 'DISMISSED'));

-- Where the phrase ended up. ON DELETE is deliberately absent, which means NO
-- ACTION: a catalogue entry cannot be deleted while a suggestion points at it.
-- That is the right way round -- entries are retired with active = FALSE and
-- never removed, exactly as trades are, so the constraint only ever fires
-- against somebody doing the one thing the catalogue's own rules forbid.
ALTER TABLE service_catalog_suggestion
ADD COLUMN promoted_to UUID REFERENCES service_catalog (id);

-- The two columns are one fact and have to agree. Without this, a row could
-- claim PROMOTED and point nowhere -- readable as "somebody handled this" with
-- nothing to show for it, which is worse than either honest state.
ALTER TABLE service_catalog_suggestion
ADD CONSTRAINT service_catalog_suggestion_promotion_check CHECK (
    (status = 'PROMOTED') = (promoted_to IS NOT NULL)
);

-- The one question the queue is opened for: what is asked for most and still
-- undecided. Partial, because the answered rows are the bulk after a while and
-- none of them belong in that list.
CREATE INDEX service_catalog_suggestion_open_idx ON service_catalog_suggestion (seen_count DESC)
WHERE
    status = 'NEW';
