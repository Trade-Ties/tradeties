-- ---------------------------------------------------------------------------
-- The trade catalogue.
--
-- Repeatable, not versioned: the list grows with market demand, and every
-- addition should not force a new numbered file. Flyway re-runs this file
-- whenever its checksum changes, and always after all versioned migrations --
-- so `trade` from V3 is guaranteed to exist by the time this runs.
--
-- Being re-run is what makes the four rules below load-bearing. Getting any of
-- them wrong breaks foreign keys in production on the SECOND run, not the
-- first, which is the worst possible time to find out.
--
--   1. FIXED UUIDs, never generated. gen_random_uuid() would hand out new keys
--      on every run, and no business_trade row would point at anything.
--   2. INSERT ... ON CONFLICT (code) DO UPDATE, never DELETE + INSERT.
--   3. NEVER remove a referenced trade. Taking one off the market means
--      active = FALSE; a DELETE either fails on business_trade or takes
--      profiles down with it.
--   4. `code` IS the identity, not display_name. The upsert keys on it, so
--      editing a code does not rename a trade -- it leaves the old row behind
--      untouched and inserts a second one. Rename the display_name instead.
--
-- Rule 3 has a quiet corollary: deleting a LINE from this file does not delete
-- the row either, because an upsert never removes anything. A trade dropped
-- from the list below simply stops being maintained and lingers as active.
-- Retire one by keeping its line and setting active = FALSE.
--
-- The ids are real random v4 UUIDs, generated once and pasted in -- not a
-- readable sequence. A sequence would be easier to recognise, but it also reads
-- as test data, and it invites the next person to guess the following one
-- instead of generating it. `code` is what humans identify a trade by, and
-- trade_by_code_uidx is what the upsert below keys on; the UUID never needs to
-- be legible.
--
-- The file is the source of truth: re-running it resets display_name,
-- sort_order and active to what stands here. Deactivate a trade by editing this
-- file, not with an UPDATE against the database.
--
-- This is a product catalogue, not a standard. NAICS subsector 238 ("Specialty
-- Trade Contractors") is the official US classification, but it files plumbing
-- and HVAC under a single code because many firms do both -- and for a
-- marketplace those are two entirely different searches. If the codes are ever
-- wanted for reporting, they belong in an extra column, not in this structure.
--
-- sort_order in steps of ten, so a trade can be slotted in between without
-- renumbering the rest.
-- ---------------------------------------------------------------------------
INSERT INTO
    trade (id, code, display_name, sort_order, active)
VALUES
    (
        '0f9a5755-d3c1-4534-9c70-a4952227287d',
        'PLUMBER',
        'Plumber',
        10,
        TRUE
    ),
    (
        'fd282bd9-725d-4420-bfcd-a51b2f3bec7c',
        'AUTO_MECHANIC',
        'Auto Mechanic',
        20,
        TRUE
    ),
    (
        '4079206b-90e4-4a73-8a27-d51b25001165',
        'ELECTRICIAN',
        'Electrician',
        30,
        TRUE
    ),
    (
        '4c167ea2-bd10-4da3-8f5a-a007777dd5fe',
        'HVAC',
        'HVAC Technician',
        40,
        TRUE
    ),
    (
        '83fd6219-3e29-4f5d-8772-88d92a27c635',
        'HANDYPERSON',
        'Handyperson',
        50,
        TRUE
    ),
    (
        'd780c3c7-9aac-4b26-90f9-755b14c4b2b0',
        'LANDSCAPER',
        'Landscaper',
        60,
        TRUE
    ),
    (
        '1c3959dc-71de-4541-822d-7d05f91cfb69',
        'ROOFER',
        'Roofer',
        70,
        TRUE
    ),
    (
        'a8becbf0-8db4-4bb7-9ff8-392eb68d3dea',
        'PAINTER',
        'Painter',
        80,
        TRUE
    ),
    (
        'a5eb2e30-8e7f-4743-92ea-2cdec8642f41',
        'CARPENTER',
        'Carpenter',
        90,
        TRUE
    ),
    (
        'ed25daa3-16e4-452f-9389-706e592da0fd',
        'FLOORING_INSTALLER',
        'Flooring Installer',
        100,
        TRUE
    ),
    (
        '475b9d57-83a5-4162-a748-9dc53c367021',
        'GENERAL_CONTRACTOR',
        'General Contractor',
        110,
        TRUE
    ),
    (
        'f6d3716c-ee07-4f49-b40e-6b6a1f2430df',
        'MASON',
        'Mason',
        120,
        TRUE
    ),
    (
        'a898dcfd-bb1c-46b7-a08e-942bf4a0590a',
        'INSTALLATION_TECHNICIAN',
        'Installation Technician',
        130,
        TRUE
    ),
    (
        '88e3f295-fb41-4c9b-ac17-3c761175929c',
        'WELDER_FABRICATOR',
        'Welder/Fabricator',
        140,
        TRUE
    ),
    (
        'db5c308c-af53-47ff-b08c-f6ea01f9aba5',
        'INDUSTRIAL_MECHANIC',
        'Industrial Mechanic',
        150,
        TRUE
    ),
    (
        '4f8dabfa-ed90-4288-a59f-fbb59955ef96',
        'ARTISAN',
        'Artisan',
        160,
        TRUE
    ) ON CONFLICT (code)
DO
UPDATE
SET
    display_name = EXCLUDED.display_name,
    sort_order = EXCLUDED.sort_order,
    active = EXCLUDED.active;