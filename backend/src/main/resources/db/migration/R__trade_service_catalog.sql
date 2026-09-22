-- ---------------------------------------------------------------------------
-- The 72 jobs a customer can pick, and the words that find each one.
--
-- Editorial content, not schema, for the same reason R__trade_search_terms.sql
-- is: which jobs exist changes when somebody learns how people describe a
-- problem, and that is a different rhythm from the table V18 creates.
--
-- NAMED FOR ORDERING, NOT FOR READABILITY, and renaming it breaks the file.
-- Every row here joins `trade` to resolve trade_code, and the trades themselves
-- are seeded by another repeatable. Flyway runs repeatables after all versioned
-- migrations, among themselves in order of description -- so this file has to
-- sort after "trade reference data", which is why it is called trade_service_
-- catalog rather than service_catalog. Sorting first would not fail loudly: the
-- join would match nothing, INSERT would write zero rows, and the marketplace
-- would come up with an empty catalogue and no error. ServiceCatalogSeedTests
-- pins the count so that stays impossible.
--
-- THIS FILE IS SEED, NOT THE SOURCE OF TRUTH, and that is the opposite of what
-- R__trade_reference_data.sql says about itself. Read this paragraph before
-- editing anything below it.
--
-- `ON CONFLICT (code) DO NOTHING` at the bottom is what makes the difference.
-- The catalogue is meant to grow at runtime: a job a tradesperson typed and a
-- search a customer ran that matched nothing both become suggestions, and
-- promoting one writes a row here without anybody deploying. An upsert would
-- undo that work -- and not on every deploy, which would at least be noticed,
-- but on the next deploy whose checksum changed. Adding ONE line below would
-- silently reset the label, synonyms, sort order and active flag of all the
-- others to whatever this file happens to say.
--
-- So: adding an entry here still works and still plants it. CHANGING one here
-- does nothing to any database that already has it. Fix a label in the running
-- system, not in this file, or the fix goes nowhere and takes an afternoon to
-- explain.
--
-- The other rules in R__trade_reference_data.sql -- fixed UUIDs, never
-- delete-and-insert, never remove a referenced row, `code` is the identity --
-- apply here unchanged and are not repeated.
--
-- WHERE THESE CAME FROM. Derived from the 74 services in
-- infra/postgres/dev-seed-marketplace.sql, one entry per job, with the full
-- mapping written up in SERVICE_CATALOG.local.md. Only two seeded services
-- merged -- an emergency leak filed twice under different names, and the same
-- thermostat job filed under two trades -- because the seed was written to make
-- 24 businesses look distinct. The work this file actually does is translation:
-- around twenty of those 74 names are words no customer types.
--
-- The gaps are in that document too, and they are not in this file: "my roof is
-- leaking", "exterior house painting" and "lay new carpet" are among the
-- highest-volume searches in their trades and no business in the seed offers
-- any of them. They belong here the day somebody decides a catalogue entry with
-- no supplier is worth showing -- which it is, because it is the only way the
-- demand gets recorded.
--
-- HOW TO WRITE A GOOD ENTRY. The label is what the customer reads: verb-first
-- where there is a verb, under about six words so it survives a narrow
-- dropdown, and in their words -- "Unclog a sink drain", never "Drain
-- cleaning". The synonyms are what the typeahead matches, and they deliberately
-- carry both sides: the symptom a customer types and the jargon a pro types, so
-- the same field finds the entry for one and suggests it to the other.
--
-- One entry per customer job. When two trades do the same work, they link the
-- same entry -- service_catalog_by_label_uidx refuses the second copy, and
-- V18 explains why the trade on the entry does not decide who is found.
-- ---------------------------------------------------------------------------
INSERT INTO
    service_catalog (id, code, trade_id, label, synonyms, sort_order, active)
SELECT
    v.id::UUID,
    v.code,
    t.id,
    v.label,
    v.synonyms,
    v.sort_order::INT,
    TRUE
FROM
    (
        VALUES
            -- Plumber
            ('77e5cb4c-75e1-4243-969b-88a82acbdd43', 'PLUMBER_DRAIN_UNCLOG', 'PLUMBER', 'Unclog a sink, tub or shower drain', 'blocked drain, clogged, slow draining, backed up, standing water, snake, auger, drain cleaning', 10),
            ('31b4a758-cde5-45a2-8eb6-b2e25674b1d9', 'PLUMBER_SEWER_MAIN_CLEAR', 'PLUMBER', 'Clear a blocked main sewer line', 'sewer backup, sewage smell, main line, rooter, hydro jet, basement backing up', 20),
            ('69bb1927-a8c3-4c80-ae8e-83e49145e8a7', 'PLUMBER_SEWER_CAMERA', 'PLUMBER', 'Camera inspection of a sewer line', 'sewer scope, CCTV, camera survey, root intrusion, recurring blockage', 30),
            ('41c01456-c08f-49ec-9530-d605871bdc25', 'PLUMBER_LEAK_EMERGENCY', 'PLUMBER', 'Emergency leak - water is running now', 'burst pipe, flooding, water everywhere, shut off, same day, after hours, emergency', 40),
            ('f7913734-9f7a-4e3c-a7c6-ae1afc109518', 'PLUMBER_PIPE_THAW', 'PLUMBER', 'Thaw a frozen pipe', 'frozen, no water, winter, pipe froze, thaw', 50),
            ('effd7f04-934d-42d2-826e-cbaf6c7ef891', 'PLUMBER_WATER_HEATER_REPLACE', 'PLUMBER', 'Replace a water heater', 'no hot water, new water heater, tank, tankless, heater install, boiler swap', 60),
            ('c2be38ee-0442-451a-8306-44410d140d21', 'PLUMBER_WATER_HEATER_SERVICE', 'PLUMBER', 'Service or flush a water heater', 'descale, flush, tankless service, annual service, sediment, tune-up', 70),
            ('b670eedc-62af-4d67-9f63-22ade9084618', 'PLUMBER_FIXTURE_INSTALL', 'PLUMBER', 'Install or replace a faucet, sink or shower valve', 'faucet, tap, mixer, dripping, leaking faucet, sink, basin, shower valve', 80),
            ('a7797bb5-51eb-4dae-a0ad-f73bf1d87182', 'PLUMBER_TOILET_REPLACE', 'PLUMBER', 'Replace a toilet', 'new toilet, running toilet, leaking at the base, wobbly, haul away', 90),
            ('c97629cb-d431-4479-84a6-2d724a97797a', 'PLUMBER_REPIPE_ASSESS', 'PLUMBER', 'Assess repiping the whole house', 'repipe, old pipes, galvanized, low water pressure, whole house survey', 100),
            ('831109ea-02aa-4eb7-983f-c420888d64ed', 'PLUMBER_SUMP_PUMP_INSTALL', 'PLUMBER', 'Install a sump pump', 'basement water, flooding, sump, pit, discharge line, wet basement', 110),
            ('5c1b07f7-17f6-4935-b0cb-afe12d5acbcb', 'PLUMBER_BATHROOM_ROUGH_IN', 'PLUMBER', 'Plumbing for a bathroom remodel', 'rough-in, finish plumbing, move a drain, new bathroom, relocate', 120),
            ('32cf6354-bca5-4ecc-b896-062281164faa', 'PLUMBER_BOILER_SERVICE', 'PLUMBER', 'Service a boiler', 'boiler tune-up, hydronic, annual service, radiators, no heat', 130),

            -- Electrician
            ('52d15485-dc19-4221-a873-aac62990304a', 'ELECTRICIAN_PANEL_UPGRADE', 'ELECTRICIAN', 'Upgrade the electrical panel', '100 amp, 200 amp, service upgrade, fuse box, more capacity, permit', 140),
            ('22c2ce19-539c-4a0b-aecd-b2b03c6dbc48', 'ELECTRICIAN_BREAKER_REPLACE', 'ELECTRICIAN', 'Replace a breaker', 'blown breaker, single breaker, fuse, same panel', 150),
            ('8079d680-fd1b-407e-929f-66d6a76031d8', 'ELECTRICIAN_FAULT_DIAGNOSE', 'ELECTRICIAN', 'Find out why something electrical stopped working', 'dead outlet, no power, breaker keeps tripping, flickering lights, short circuit, burning smell, sparking', 160),
            ('b8bfb9d8-f8f4-4fe6-a608-f51b90092466', 'ELECTRICIAN_OUTLET_SWITCH', 'ELECTRICIAN', 'Add or replace an outlet or switch', 'socket, receptacle, light switch, dimmer, extra outlet, new opening', 170),
            ('228b3a86-614d-4fb4-9367-9858514c8959', 'ELECTRICIAN_CEILING_FAN', 'ELECTRICIAN', 'Install a ceiling fan', 'fan, replace fan, new box, wobbling fan', 180),
            ('d2e08bee-c3f9-44d8-a38b-9194e6eec0c3', 'ELECTRICIAN_LIGHTING_INSTALL', 'ELECTRICIAN', 'Install recessed or new lighting', 'can lights, downlights, spotlights, LED, convert to LED, dimmer, light fitting, layout', 190),
            ('9dd0981f-8e45-40e1-a817-a57577d88f8e', 'ELECTRICIAN_EV_CHARGER', 'ELECTRICIAN', 'Install an EV charger', 'wallbox, level 2, car charger, electric car, charging point', 200),
            ('d09ef3a9-d5c8-4653-88b7-5f0e055dbf21', 'ELECTRICIAN_SURGE_PROTECTION', 'ELECTRICIAN', 'Install surge protection', 'surge protector, whole home, panel mounted, lightning, power spike', 210),
            ('8d4582f2-9b42-4c6d-bb9a-7908569eb214', 'ELECTRICIAN_SAFETY_INSPECTION', 'ELECTRICIAN', 'Electrical safety inspection', 'certificate, written report, buying a house, code check, room by room', 220),
            ('92541ac3-df3c-4875-9236-253d1e21fb85', 'ELECTRICIAN_LOW_VOLTAGE_CABLE', 'ELECTRICIAN', 'Run data, speaker or camera cable', 'ethernet, network point, cat6, low voltage, structured wiring, TV aerial, speaker wire', 230),

            -- Carpenter
            ('2c45bb8a-9efe-4601-91c2-1e5608de4780', 'CARPENTER_SHELVING_BUILD', 'CARPENTER', 'Build custom shelving', 'bookcase, floating shelves, alcove, built-in, made to measure', 240),
            ('591bb630-24ea-467d-aa85-fc4ae5e26927', 'CARPENTER_CLOSET_BUILD', 'CARPENTER', 'Build out a closet or wardrobe', 'fitted wardrobe, closet, rods, hanging space, storage', 250),
            ('49801728-7fe9-4e19-b166-2c722a63f409', 'CARPENTER_DOOR_HANG', 'CARPENTER', 'Hang or replace a door', 'door will not close, sticking door, pre-hung, slab, door frame, new door', 260),
            ('0569cee5-18e9-4c97-940b-7f73b699ef86', 'CARPENTER_DECK_REPAIR', 'CARPENTER', 'Repair a deck', 'decking, boards, joists, railings, rotten, soft spot, springy', 270),
            ('4df0d8ab-65ac-45d4-bbf0-c9d38b83b7c4', 'CARPENTER_CABINET_REPAIR', 'CARPENTER', 'Reface or repair cabinets', 'cabinet doors, drawer fronts, hardware, broken hinge, kitchen cabinets', 280),
            ('74983003-2bdc-4596-94c2-13614f730f6d', 'CARPENTER_TRIM_INSTALL', 'CARPENTER', 'Install trim and baseboards', 'skirting, architrave, moulding, casing, crown, per room', 290),
            ('1311a7dd-abae-4d8f-8271-dac3cffaf4d2', 'CARPENTER_STAIR_RAILING', 'CARPENTER', 'Repair stairs or a railing', 'loose baluster, newel, handrail, banister, squeaky stairs, wobbly rail', 300),
            ('993904ec-10f0-428c-aaab-47121faeb66d', 'CARPENTER_FRAMING_CREW', 'CARPENTER', 'Framing crew (day rate)', 'framing, studs, walls, day rate, two-person crew, rough carpentry', 310),

            -- HVAC. The thermostat entry carries both the HVAC and the
            -- Installation Technician service from the seed; V18 says why one
            -- entry is right and which join makes it work.
            ('133eb7cb-cc68-488c-8ae2-16b2195e0f12', 'HVAC_AC_SERVICE', 'HVAC', 'Service the air conditioning', 'AC tune-up, not cooling, coil clean, refrigerant charge, filter, annual service', 320),
            ('6087549d-3f70-4aa0-9286-7a706483345e', 'HVAC_FURNACE_SERVICE', 'HVAC', 'Service or inspect the furnace', 'furnace, pre-season, safety check, heating service, efficiency check', 330),
            ('cba84036-5736-4c54-a1c2-daf952c3be1d', 'HVAC_FURNACE_REPLACE', 'HVAC', 'Replace the furnace or boiler', 'new furnace, boiler replacement, heating system, removal, permit', 340),
            ('b9e76587-9d31-49a9-aa5c-41742d259ca4', 'HVAC_THERMOSTAT_INSTALL', 'HVAC', 'Install a thermostat', 'thermostat, smart thermostat, not responding, wired, wall unit', 350),

            -- Roofer
            ('b4394c67-0cac-4656-b1c3-aac56b16bef4', 'ROOFER_INSPECTION', 'ROOFER', 'Roof inspection', 'check my roof, written report, photos, buying a house, survey', 360),
            ('c491448e-234f-47b7-a8b7-b565cbdf8505', 'ROOFER_STORM_ASSESS', 'ROOFER', 'Storm or hail damage assessment', 'hail, storm, wind damage, insurance claim, documentation, adjuster', 370),
            ('8b2dc2ed-3168-4fcb-8cde-88fa7274d620', 'ROOFER_ROOF_REPLACE', 'ROOFER', 'Replace the roof', 'tear off, re-roof, new roof, shingles, full replacement', 380),
            ('a2e9ba54-5e6e-4738-afbf-3b8c79eeb84d', 'ROOFER_FLAT_ROOF_REPAIR', 'ROOFER', 'Repair a flat roof', 'TPO, EPDM, bitumen, membrane, ponding, flat roof leak', 390),
            ('23d05715-4b87-470f-b232-ee586d6a26d2', 'ROOFER_GUTTER_WORK', 'ROOFER', 'Replace or repair gutters', 'gutter, downspout, seamless, overflowing, blocked gutter, fascia', 400),

            -- Painter
            ('a1aa6f28-9278-4093-ae6c-587a78d1df2b', 'PAINTER_ROOM_REPAINT', 'PAINTER', 'Repaint a room', 'walls and ceiling, two coats, interior, fresh coat, redecorate', 410),
            ('d9e47a12-fe4a-4938-844a-860d7c880205', 'PAINTER_TOUCH_UP', 'PAINTER', 'Touch up and patch paint', 'patch, prime, match existing, scuffs, small area, filler', 420),
            ('345b19e0-95e8-4268-83c9-df3b8efcc29d', 'PAINTER_CABINET_SPRAY', 'PAINTER', 'Spray or refinish cabinets', 'cabinet painting, sprayed, respray, kitchen cabinets, sanded', 430),
            ('3c0cbc8a-07c3-4099-83b1-cdce0f192ee0', 'PAINTER_DECK_STAIN', 'PAINTER', 'Stain a deck or fence', 'stain, seal, clean and sand, fence, deck, weathered', 440),

            -- Mason
            ('b3813745-5a6b-4c73-87ac-1c7540ed7d91', 'MASON_REPOINT', 'MASON', 'Repoint brickwork', 'mortar, crumbling, repointing, tuckpointing, grind out, loose bricks', 450),
            ('c3d3fe29-ac6b-46ea-876c-f5fa1aabac50', 'MASON_CHIMNEY_REBUILD', 'MASON', 'Rebuild or repair a chimney', 'chimney, above the roofline, flashing, crown, stack, leaning', 460),
            ('73a2c08a-b7dc-4560-b9a8-32c1b6781f8e', 'MASON_FOUNDATION_CRACK', 'MASON', 'Repair a foundation crack', 'foundation, crack, epoxy injection, structural, basement wall', 470),
            ('175b8403-8cc4-42ec-97fe-5a617746fd08', 'MASON_RETAINING_WALL', 'MASON', 'Build or repair a retaining wall', 'retaining wall, garden wall, leaning, re-set, drainage, bulging', 480),

            -- Flooring installer
            ('f1a98dda-a25e-47ae-b23d-a77b3508295a', 'FLOORING_VINYL_PLANK', 'FLOORING_INSTALLER', 'Install vinyl plank flooring', 'LVP, LVT, vinyl, luxury vinyl, planks, click floor, underlay', 490),
            ('416df8cc-f1de-48e3-805d-894372564c64', 'FLOORING_HARDWOOD_REFINISH', 'FLOORING_INSTALLER', 'Refinish hardwood floors', 'sand, stain, refinish, worn, scratched, three coats, seal', 500),
            ('232d0b0a-4b27-401f-b175-6ee102c71541', 'FLOORING_TILE_REPAIR', 'FLOORING_INSTALLER', 'Repair floor tiles or grout', 'cracked tile, grout, threshold, loose tile, regrout', 510),

            -- Landscaper
            ('739a1739-a2ac-4e80-9d7b-312cbcf06a8d', 'LANDSCAPER_SEASONAL_CLEANUP', 'LANDSCAPER', 'Seasonal yard clean-up', 'spring cleanup, fall cleanup, leaves, cut back, rake, edge, haul away, overgrown', 520),
            ('2062b7cc-2c22-4f6e-87ad-05c2e72607b7', 'LANDSCAPER_SPRINKLER_SERVICE', 'LANDSCAPER', 'Winterize or repair sprinklers', 'blowout, irrigation, sprinkler, zones, winterisation, broken head', 530),
            ('2cb66def-e063-4701-bf7f-3da8c901c845', 'LANDSCAPER_XERISCAPE_DESIGN', 'LANDSCAPER', 'Design a low-water yard', 'xeriscape, drought tolerant, planting plan, water wise, landscape design', 540),

            -- General contractor
            ('a531eb11-3dc4-43be-bc15-7a84c2e627c9', 'GENERAL_CONTRACTOR_CONSULT', 'GENERAL_CONTRACTOR', 'Consultation for a bigger project', 'scope, budget, where do I start, build sequence, planning', 550),
            ('c3b0209c-d146-4bdb-902e-5c10b1c69296', 'GENERAL_CONTRACTOR_BASEMENT', 'GENERAL_CONTRACTOR', 'Finish a basement', 'basement, framing to final, conversion, finished basement, permit', 560),
            ('6a60c656-be86-42d4-918a-db9627c54cef', 'GENERAL_CONTRACTOR_STORM_REBUILD', 'GENERAL_CONTRACTOR', 'Rebuild after storm damage', 'storm, insurance, roof siding interior, managed end to end, restoration', 570),

            -- Auto mechanic
            ('4d545b14-dded-44c3-b251-97449f528efc', 'AUTO_MECHANIC_OIL_CHANGE', 'AUTO_MECHANIC', 'Oil and filter change', 'oil change, synthetic, service, quarts', 580),
            ('40f024b0-319e-42ed-8c79-950f0fc7fb7e', 'AUTO_MECHANIC_BRAKE_SERVICE', 'AUTO_MECHANIC', 'Brake service', 'brakes, pads, rotors, squealing, grinding, per axle, spongy pedal', 590),
            ('a4b5ddbd-4ca1-4ff0-80b5-645d3590406e', 'AUTO_MECHANIC_ENGINE_DIAGNOSE', 'AUTO_MECHANIC', 'Check engine light diagnosis', 'check engine, warning light, scan, OBD, diagnostics, code', 600),

            -- Handyperson
            ('001d91fe-aa3e-433b-95e9-b1cc72f48849', 'HANDYPERSON_HALF_DAY', 'HANDYPERSON', 'A half-day of small jobs', 'odd jobs, my list, small tasks, bits and pieces, handyman, punch list', 610),
            ('13edee5e-35d1-4b62-bb1d-07758cfd7e47', 'HANDYPERSON_TV_MOUNT', 'HANDYPERSON', 'Mount a TV', 'TV mount, bracket, wall mount, cable tidy, above the fireplace', 620),

            -- Installation technician. The seed's second service, a smart
            -- thermostat, links HVAC_THERMOSTAT_INSTALL instead of duplicating it.
            ('11d0228f-0d26-443e-b909-a653e11d3dd9', 'INSTALLATION_TECHNICIAN_DOORBELL', 'INSTALLATION_TECHNICIAN', 'Install a video doorbell', 'ring, doorbell camera, smart doorbell, transformer, chime', 630),

            -- Welder / fabricator
            ('6ab2ae68-868f-4e46-a8de-baccc12c4653', 'WELDER_MOBILE_CALLOUT', 'WELDER_FABRICATOR', 'Mobile welding on site', 'welding, MIG, stick, on site, mobile welder, weld a crack, call-out', 640),
            ('cbc21c32-b8b4-433e-96c2-8fca8a08b754', 'WELDER_HANDRAIL_FAB', 'WELDER_FABRICATOR', 'Fabricate a handrail or railing', 'metal railing, handrail, custom, iron, measured and installed', 650),
            ('73c21392-9465-4ae1-b45a-1fce57515927', 'WELDER_TRAILER_REPAIR', 'WELDER_FABRICATOR', 'Repair a trailer or hitch', 'hitch, receiver, trailer, safety chains, tow bar, mounts', 660),

            -- Industrial mechanic
            ('2958f5b3-6d12-4c8a-a83c-eda37920a44f', 'INDUSTRIAL_CONVEYOR_SERVICE', 'INDUSTRIAL_MECHANIC', 'Service a conveyor', 'conveyor, belts, bearings, alignment, tracking', 670),
            ('0c37c97f-3b72-40d0-b82d-71c0cbad7d93', 'INDUSTRIAL_PUMP_REBUILD', 'INDUSTRIAL_MECHANIC', 'Rebuild an industrial pump', 'pump, rebuild, impeller, seals, strip and test', 680),
            ('f3525591-e841-4f44-bb13-a1a677b8f318', 'INDUSTRIAL_PREVENTIVE_MAINTENANCE', 'INDUSTRIAL_MECHANIC', 'Scheduled preventive maintenance', 'PM visit, preventive, scheduled inspection, plant maintenance, report', 690),

            -- Artisan
            ('a7809dbf-78c6-4263-9323-bdc5b717e421', 'ARTISAN_METAL_SIGN', 'ARTISAN', 'Custom metal sign or artwork', 'sign, custom, cut to order, metal art, bespoke', 700),
            ('e69ceea4-1f55-450d-898b-5d25bc938596', 'ARTISAN_FURNITURE_RESTORE', 'ARTISAN', 'Restore furniture', 'restoration, strip, refinish, antique, repair furniture', 710),
            ('8a317a06-2b09-436e-9733-1feb920c8860', 'ARTISAN_STAINED_GLASS', 'ARTISAN', 'Repair stained glass', 'stained glass, leaded, re-lead, replacement panes, church window', 720)
    ) AS v (id, code, trade_code, label, synonyms, sort_order)
    JOIN trade t ON t.code = v.trade_code
ON CONFLICT (code) DO NOTHING;
