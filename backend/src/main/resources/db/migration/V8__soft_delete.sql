-- ---------------------------------------------------------------------------
-- When rows stopped being destroyed.
--
-- V7 gave the composite foreign key ON DELETE CASCADE, so giving up a trade
-- destroyed the services filed under it. That is the right *visible* behaviour
-- -- a service cannot be offered under a trade the business no longer claims --
-- and the wrong way to get it. The row is the only record that the work was
-- ever offered, at that price, under that name; a tradesperson who unticks a
-- trade to see what happens should not be able to lose six months of catalogue
-- to a checkbox.
--
-- So nothing is deleted any more. A row that leaves is stamped with the moment
-- it left and disappears from every read, which is what the API already meant
-- by "removed" and what the caller cannot tell apart.
--
-- A timestamp rather than a boolean, for the reason V6 gave when it chose
-- first_published_at over a flag: it costs the same, it is the honest record of
-- an event that happened once, and it answers "when" without a second
-- migration. Every rule below reads it as a null check and nothing more.
--
-- On the two halves being spelled differently in Java: business_service uses
-- Hibernate's @SoftDelete, which filters every query and rewrites every delete
-- without anybody remembering to. business_trade does not, because a retired
-- link is meant to be found again -- re-ticking a trade revives the row it
-- already has -- and an unconditional filter is exactly what would hide it.
-- That table has one owner, TradeSelectionService, and four repository
-- methods. Three name the condition out loud. The fourth is the one that
-- revives a re-ticked trade, so it must see retired rows -- and its name
-- cannot say so, because Spring Data derives the query from the name and has
-- no keyword for including them. Its javadoc carries that instead.
-- ---------------------------------------------------------------------------
ALTER TABLE business_trade
ADD COLUMN deleted_at TIMESTAMP(6)
WITH
    TIME ZONE;

-- The index counts live rows only. BusinessTradeLink.retire clears is_primary
-- on the way out, so today the row that left would not collide either way --
-- but that is the application remembering, and this is the guarantee. Without
-- the condition here, one forgotten line in Java turns giving up a primary
-- trade and choosing another into a violation against a row nothing can see.
DROP INDEX business_trade_primary_uidx;

CREATE UNIQUE INDEX business_trade_primary_uidx ON business_trade (business_id)
WHERE
    is_primary
    AND deleted_at IS NULL;

ALTER TABLE business_service
ADD COLUMN deleted_at TIMESTAMP(6)
WITH
    TIME ZONE;

-- The name is free again once the service holding it is gone. Removing "Clog
-- removal" and adding it back is the most ordinary thing on that screen, and
-- against the unrestricted index it was a 409 about a service the tradesperson
-- could no longer see. The partial index says the same thing the application
-- does: uniqueness is a rule about the services a business *has*.
DROP INDEX business_service_by_name_uidx;

CREATE UNIQUE INDEX business_service_by_name_uidx ON business_service (business_id, lower(name))
WHERE
    deleted_at IS NULL;

-- No delete action at all, where V7 had CASCADE. Nothing removes a
-- business_trade row any more, so the clause describes a case that should not
-- happen -- and NO ACTION is what turns it into a loud failure instead of a
-- silent tear-through if some future hand-written DELETE tries.
--
-- NO ACTION rather than RESTRICT, and the difference is not stylistic here.
-- Deleting a business_profile still cascades to both of these tables at once;
-- RESTRICT is checked per row as it happens and would fire depending on which
-- child PostgreSQL reaches first, while NO ACTION is checked at the end of the
-- statement, by which time both are gone.
--
-- Still composite, and still onto business_trade rather than trade, for the
-- reason V3 gave: it checks in one constraint both that the trade exists and
-- that this business offers it. What it no longer checks is that the link is
-- live -- a service retired alongside its trade points at a retired link, which
-- is the pair being kept together rather than a dangling row. Keeping those two
-- stamps consistent is TradeSelectionService's job; no constraint can compare
-- them.
ALTER TABLE business_service
DROP CONSTRAINT business_service_business_id_trade_id_fkey;

ALTER TABLE business_service
ADD FOREIGN KEY (business_id, trade_id) REFERENCES business_trade (business_id, trade_id);
