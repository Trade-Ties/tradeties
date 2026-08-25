-- ---------------------------------------------------------------------------
-- When a service stopped being able to stand outside a trade.
--
-- V3 left business_service.trade_id nullable and gave the composite foreign key
-- ON DELETE SET NULL (trade_id), so dropping a trade unfiled its services
-- rather than removing them. Null therefore meant "work that spans trades", and
-- the wizard offered it as a choice called "Cross-trade".
--
-- That is no longer the model. A service belongs to exactly one trade, and a
-- trade the business gives up takes its services with it. Two consequences
-- follow, and this migration is both of them: the column becomes mandatory, and
-- SET NULL becomes CASCADE.
--
-- Ordering matters and is not cosmetic. The backfill has to run while the
-- column still accepts null, and the old foreign key has to be gone before the
-- new one is added -- a table cannot hold two constraints over the same columns
-- with contradictory delete actions and let the second one win.
-- ---------------------------------------------------------------------------
-- Existing unfiled rows, first case: the business has a primary trade, so there
-- is one answer that is both correct under the new model and accepted by the
-- composite foreign key, which checks (business_id, trade_id) against
-- business_trade rather than against the catalogue.
--
-- The primary trade rather than an arbitrary held one. It is the trade the
-- business leads with, so it is the least surprising place for a service that
-- named none to land, and it is the same default the wizard now fills in for a
-- newly added row.
UPDATE business_service AS s
SET
    trade_id = t.trade_id
FROM
    business_trade AS t
WHERE
    s.trade_id IS NULL
    AND t.business_id = s.business_id
    AND t.is_primary;

-- Second case: no primary trade to inherit, which means the business never got
-- past onboarding step 3. There is no value that would satisfy the foreign key,
-- and no way to represent the row under a model where every service has a
-- trade, so the row goes.
--
-- Deleting rather than refusing to migrate. These are draft services on drafts
-- that never chose a trade; nothing references business_service yet
-- (ServiceUsageContractTests asks PostgreSQL exactly that and fails the build
-- the day it stops being true), so nothing is torn up behind them.
DELETE FROM business_service
WHERE
    trade_id IS NULL;

-- The inline FOREIGN KEY in V3 was unnamed, so PostgreSQL derived
-- <table>_<column>_<column>_fkey from the column list. Dropping it by that name
-- is what the generated name is for.
ALTER TABLE business_service
DROP CONSTRAINT business_service_business_id_trade_id_fkey;

-- CASCADE, not SET NULL: giving up a trade gives up the services filed under
-- it. The column list SET NULL needed is not required here -- CASCADE removes
-- the row, so there is no question of which column it would touch.
--
-- Still composite, and still onto business_trade rather than trade, for the
-- reason V3 gave: it checks in one constraint both that the trade exists and
-- that this business offers it.
--
-- This makes TradeSelectionService.replaceForOwner's care about which links it
-- deletes load-bearing in a way it was not before. Deleting every link and
-- re-inserting the survivors used to unfile every service; now it would delete
-- every service the business has. The service deletes only what actually
-- leaves, and changingTheTradesKeepsServicesFiledUnderTheOnesThatStay is the
-- test that says so.
ALTER TABLE business_service
ADD FOREIGN KEY (business_id, trade_id) REFERENCES business_trade (business_id, trade_id) ON DELETE CASCADE;

-- Last, once every row has a trade. The application checks this too and answers
-- 400 naming the trade that was wrong; the constraint is what holds when the
-- write does not come through the application.
ALTER TABLE business_service
ALTER COLUMN trade_id
SET NOT NULL;
