-- ---------------------------------------------------------------------------
-- Twenty-four published businesses, so the marketplace has something to search.
--
-- postgres/dev-seed.sql seeds ONE finished business, which is enough to open the
-- portal and wrong for everything the customer side does: a result list of one
-- sorts trivially, a trade facet with one entry filters nothing, and a radius
-- search cannot be told apart from a table scan. This file exists for the other
-- half -- ranking, facets, ZIP lookup, the empty state that should not appear.
--
-- WHAT IT COVERS, and why those numbers:
--   * 5 plumbers, 3 electricians, 2 carpenters, 2 roofers, and one business for
--     each remaining trade in R__trade_reference_data.sql -- 24 in total. Every
--     trade in the catalogue is held by somebody, so no facet is ever empty, and
--     four of them are held by several, so ranking within a trade is visible.
--   * Five ZIP codes across Denver (80202, 80204, 80206, 80209, 80239), four to
--     five businesses each. Same-ZIP businesses share a point exactly -- these
--     are centroids -- which is the tie the search's `ORDER BY distance, slug`
--     exists for, and it is only reachable with more than one business per ZIP.
--   * Service radii from 10 to 50 miles. The radius belongs to the row (V16), so
--     a search from the edge of town must return the wide-radius businesses and
--     drop the narrow ones. One radius everywhere would never show that.
--   * Every pricing mode, every travel and material mode, and licences verified,
--     unverified and expired -- the badge logic in BusinessSearchRepository
--     reads all three of those states and only one is the happy path.
--
-- Run BY HAND against a database the backend has already migrated:
--
--   docker compose exec -T postgres \
--     psql -v ON_ERROR_STOP=1 -U tradeties -d tradeties < postgres/dev-seed-marketplace.sql
--
-- Not a Flyway migration, for the reason dev-seed.sql gives at length: Flyway
-- owns the schema, `ddl-auto: validate` keeps the code honest against it, and a
-- migration that exists only on developer machines is the drift that prevents.
--
-- These businesses belong to placeholder subjects nobody can sign in as. That is
-- deliberate -- they are inventory for the customer side, not businesses to
-- administer. Use dev-seed.sql with your own WorkOS subject for that.
--
-- Idempotent: running it twice does nothing the second time.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    now_utc TIMESTAMPTZ := now();
BEGIN
    -- One guard for the whole script rather than ON CONFLICT per statement.
    -- availability_working_hours carries an exclusion constraint, so a second run
    -- has to be stopped before the first INSERT rather than caught after it.
    IF EXISTS (SELECT 1 FROM identity_user WHERE workos_user_id LIKE 'dev_seed_marketplace:%') THEN
        RAISE NOTICE 'Marketplace seed already present -- nothing seeded.';
        RETURN;
    END IF;

    -- =======================================================================
    -- The data, as tables rather than as 24 hand-written INSERT blocks.
    -- =======================================================================

    -- Ids are derived from the slug with md5, not generated. gen_random_uuid()
    -- would hand out new keys on every run, so a run interrupted halfway could
    -- not be repeated -- and a fixed id lets you find the same business again
    -- after a reset without looking it up first.
    CREATE TEMP TABLE seed_business (
        slug                 TEXT PRIMARY KEY,
        display_name         TEXT NOT NULL,
        description          TEXT NOT NULL,
        trade_code           TEXT NOT NULL,   -- the primary trade
        street1              TEXT NOT NULL,
        postal_code          TEXT NOT NULL,
        service_radius_miles INT  NOT NULL,
        schedule             TEXT NOT NULL,   -- into seed_schedule
        policy               TEXT NOT NULL    -- into seed_policy
    ) ON COMMIT DROP;

    INSERT INTO seed_business VALUES
        -- Plumbers: one per ZIP, so "plumber near me" ranks differently from
        -- every one of the five search origins.
        ('summit-drain-plumbing',      'Summit Drain Plumbing',        'Drains, water heaters and same-day emergency call-outs across downtown Denver.', 'PLUMBER',                 '1544 Wynkoop St',   '80202', 25, 'STANDARD', 'STANDARD'),
        ('mile-high-pipeworks',        'Mile High Pipeworks',          'Repipes, sewer lines and burst-pipe repair for older Denver housing stock.',     'PLUMBER',                 '820 Santa Fe Dr',   '80204', 30, 'EARLY',    'FAST'),
        ('cherry-creek-plumbing',      'Cherry Creek Plumbing Co',     'Fixtures, bathroom remodels and quiet, tidy work in occupied homes.',            'PLUMBER',                 '250 Steele St',     '80206', 20, 'STANDARD', 'PROJECT'),
        ('wash-park-water-works',      'Wash Park Water Works',        'Tankless heaters, sump pumps and winter pipe work south of downtown.',           'PLUMBER',                 '1075 S Gaylord St', '80209', 15, 'SIX_DAY',  'FAST'),
        ('montbello-plumbing-heating', 'Montbello Plumbing & Heating', 'Plumbing and heating under one roof, out to the airport corridor.',              'PLUMBER',                 '4680 Peoria St',    '80239', 40, 'EARLY',    'STANDARD'),

        ('lodo-electric',              'LoDo Electric',                'Panels, circuits and troubleshooting for lofts and small commercial spaces.',    'ELECTRICIAN',             '1738 Blake St',     '80202', 25, 'STANDARD', 'STANDARD'),
        ('front-range-current',        'Front Range Current',          'EV chargers, lighting design and service upgrades along the Front Range.',       'ELECTRICIAN',             '1201 W Colfax Ave', '80204', 35, 'SIX_DAY',  'PROJECT'),
        ('green-valley-electric',      'Green Valley Electric',        'Breakers, surge protection and safety inspections in far northeast Denver.',     'ELECTRICIAN',             '5005 Chambers Rd',  '80239', 30, 'STANDARD', 'STANDARD'),

        ('platte-river-carpentry',     'Platte River Carpentry',       'Built-ins, doors and deck repair, finished by hand.',                            'CARPENTER',               '1435 Zuni St',      '80204', 25, 'EARLY',    'PROJECT'),
        ('congress-park-woodwork',     'Congress Park Woodwork',       'Cabinetry, trim and stair work for pre-war homes.',                              'CARPENTER',               '3200 E 12th Ave',   '80206', 20, 'STANDARD', 'PROJECT'),

        ('front-range-roofing',        'Front Range Roofing',          'Hail claims, inspections and full replacements. Free first look.',               'ROOFER',                  '400 S Broadway',    '80209', 40, 'EARLY',    'STANDARD'),
        ('high-plains-roofworks',      'High Plains Roofworks',        'Flat roofs, gutters and storm rebuilds across the eastern metro.',               'ROOFER',                  '4901 Havana St',    '80239', 50, 'EARLY',    'PROJECT'),

        -- One business per remaining trade, so every facet in the catalogue has
        -- something behind it.
        ('five-points-auto',           'Five Points Auto Service',     'Independent shop for brakes, diagnostics and scheduled maintenance.',            'AUTO_MECHANIC',           '2225 Larimer St',   '80202', 10, 'SIX_DAY',  'FAST'),
        ('denver-climate-control',     'Denver Climate Control',       'Furnaces, air conditioning and thermostats, installed and serviced.',            'HVAC',                    '2900 E 6th Ave',    '80206', 30, 'STANDARD', 'STANDARD'),
        ('capitol-hill-handyman',      'Capitol Hill Handyman',        'The short list nobody else will take: mounting, patching, small repairs.',       'HANDYPERSON',             '735 E Alameda Ave', '80209', 15, 'LATE',     'FAST'),
        ('wash-park-landscaping',      'Wash Park Landscaping',        'Seasonal clean-ups, irrigation and water-wise planting.',                        'LANDSCAPER',              '1050 S Downing St', '80209', 20, 'EARLY',    'PROJECT'),
        ('baker-district-painting',    'Baker District Painting',      'Interiors, exteriors and cabinet spraying in the Baker historic district.',      'PAINTER',                 '640 Kalamath St',   '80204', 25, 'EARLY',    'PROJECT'),
        ('mile-high-flooring',         'Mile High Flooring',           'Hardwood, LVP and tile -- supplied, installed and refinished.',                  'FLOORING_INSTALLER',      '3555 E Colfax Ave', '80206', 30, 'STANDARD', 'PROJECT'),
        ('cornerstone-builders',       'Cornerstone Builders',         'Basements, additions and whole-home remodels, permits included.',                'GENERAL_CONTRACTOR',      '1900 16th St',      '80202', 45, 'STANDARD', 'PROJECT'),
        ('rocky-mountain-masonry',     'Rocky Mountain Masonry',       'Brick, block and stone: repointing, chimneys and retaining walls.',              'MASON',                   '12000 E 47th Ave',  '80239', 35, 'EARLY',    'PROJECT'),
        ('smart-home-installs',        'Smart Home Installs Denver',   'Thermostats, cameras and doorbells set up properly the first time.',             'INSTALLATION_TECHNICIAN', '1601 Wewatta St',   '80202', 25, 'LATE',     'FAST'),
        ('ironline-fabrication',       'Ironline Fabrication',         'Mobile welding, railings and structural repair, shop or on site.',               'WELDER_FABRICATOR',       '5150 Fraser St',    '80239', 40, 'EARLY',    'STANDARD'),
        ('platte-industrial-service',  'Platte Industrial Service',    'Conveyors, pumps and preventive maintenance for light industry.',                'INDUSTRIAL_MECHANIC',     '2101 W 8th Ave',    '80204', 50, 'EARLY',    'PROJECT'),
        ('cherry-creek-arts-studio',   'Cherry Creek Arts Studio',     'Restoration and commissions: furniture, stained glass and metalwork.',           'ARTISAN',                 '3000 E 3rd Ave',    '80206', 15, 'LATE',     'PROJECT');

    -- Secondary trades. Not decoration: they are what makes the trade filter
    -- differ from the primary-trade column the result list shows, and the only
    -- way a service can be filed under a trade the business does not lead with.
    CREATE TEMP TABLE seed_secondary_trade (slug TEXT, trade_code TEXT) ON COMMIT DROP;

    INSERT INTO seed_secondary_trade VALUES
        ('montbello-plumbing-heating', 'HVAC'),
        ('high-plains-roofworks',      'GENERAL_CONTRACTOR'),
        ('capitol-hill-handyman',      'PAINTER'),
        ('capitol-hill-handyman',      'CARPENTER'),
        ('cornerstone-builders',       'CARPENTER'),
        ('cornerstone-builders',       'MASON'),
        ('smart-home-installs',        'ELECTRICIAN');

    -- Money, split off from the profile the way business_pricing is split off
    -- from business_profile. Every travel and material mode appears, because V3
    -- checks each pair from both sides and a seed that only ever says INCLUDED
    -- puts not one of those constraints under load.
    CREATE TEMP TABLE seed_pricing (
        slug                      TEXT PRIMARY KEY,
        hourly_rate               NUMERIC(19, 4),
        service_call_fee          NUMERIC(19, 4),
        fee_waived_if_hired       BOOLEAN,
        travel_fee_mode           TEXT,
        travel_flat_fee           NUMERIC(19, 4),
        travel_rate_per_mile      NUMERIC(19, 4),
        material_pricing_mode     TEXT,
        material_markup_percent   NUMERIC(5, 2),
        cancellation_fee          NUMERIC(19, 4),
        cancellation_notice_hours INT
    ) ON COMMIT DROP;

    INSERT INTO seed_pricing VALUES
        ('summit-drain-plumbing',      145.00,  89.00, TRUE,  'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 15.00,  50.00,  24),
        ('mile-high-pipeworks',        135.00,  79.00, FALSE, 'FLAT',     45.00, NULL, 'AT_COST',          NULL,    0.00,  24),
        ('cherry-creek-plumbing',      165.00,  99.00, TRUE,  'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 20.00,  75.00,  48),
        ('wash-park-water-works',      125.00,  NULL,  FALSE, 'PER_MILE', NULL,  1.75, 'AT_COST',          NULL,    0.00,  12),
        ('montbello-plumbing-heating', 155.00,  69.00, TRUE,  'FLAT',     35.00, NULL, 'COST_PLUS_MARKUP', 12.50,  40.00,  24),
        ('lodo-electric',              175.00,  95.00, TRUE,  'INCLUDED', NULL,  NULL, 'AT_COST',          NULL,   60.00,  24),
        ('front-range-current',        160.00,  85.00, FALSE, 'PER_MILE', NULL,  2.00, 'COST_PLUS_MARKUP', 18.00,   0.00,  48),
        ('green-valley-electric',      150.00,  75.00, TRUE,  'FLAT',     40.00, NULL, 'INCLUDED',         NULL,   35.00,  24),
        ('platte-river-carpentry',      95.00,  NULL,  FALSE, 'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 10.00,   0.00,  24),
        ('congress-park-woodwork',     110.00,  65.00, FALSE, 'FLAT',     30.00, NULL, 'AT_COST',          NULL,   45.00,  72),
        ('front-range-roofing',        130.00,  NULL,  FALSE, 'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 22.00,   0.00,  24),
        ('high-plains-roofworks',      140.00,  NULL,  FALSE, 'PER_MILE', NULL,  2.50, 'AT_COST',          NULL,  100.00,  48),
        ('five-points-auto',           120.00,  55.00, TRUE,  'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 25.00,  25.00,  12),
        ('denver-climate-control',     155.00,  89.00, TRUE,  'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 15.00,  50.00,  24),
        ('capitol-hill-handyman',       85.00,  49.00, FALSE, 'FLAT',     25.00, NULL, 'AT_COST',          NULL,    0.00,  12),
        ('wash-park-landscaping',       75.00,  NULL,  FALSE, 'INCLUDED', NULL,  NULL, 'NOT_PROVIDED',     NULL,    0.00,  48),
        ('baker-district-painting',     90.00,  NULL,  FALSE, 'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 12.00,  30.00,  24),
        ('mile-high-flooring',         105.00,  79.00, TRUE,  'FLAT',     50.00, NULL, 'AT_COST',          NULL,   60.00,  72),
        ('cornerstone-builders',       185.00, 150.00, TRUE,  'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 18.00, 250.00, 168),
        ('rocky-mountain-masonry',     115.00,  NULL,  FALSE, 'PER_MILE', NULL,  1.50, 'AT_COST',          NULL,    0.00,  48),
        ('smart-home-installs',        135.00,  69.00, TRUE,  'INCLUDED', NULL,  NULL, 'COST_PLUS_MARKUP', 20.00,  40.00,  24),
        ('ironline-fabrication',       145.00,  NULL,  FALSE, 'FLAT',     60.00, NULL, 'COST_PLUS_MARKUP', 30.00,   0.00,  24),
        ('platte-industrial-service',  165.00, 195.00, TRUE,  'PER_MILE', NULL,  3.00, 'AT_COST',          NULL,  150.00,  72),
        ('cherry-creek-arts-studio',    95.00,  NULL,  FALSE, 'INCLUDED', NULL,  NULL, 'NOT_PROVIDED',     NULL,    0.00,  24);

    -- Services. trade_code is the trade the service is filed under, and the
    -- composite foreign key from V7 checks it against business_trade -- so every
    -- row here must name a trade its business actually holds, primary or not.
    CREATE TEMP TABLE seed_service (
        slug         TEXT,
        trade_code   TEXT,
        name         TEXT,
        description  TEXT,
        minutes      INT,
        pricing_mode TEXT,
        price        NUMERIC(19, 4)
    ) ON COMMIT DROP;

    INSERT INTO seed_service VALUES
        ('summit-drain-plumbing',      'PLUMBER',     'Drain cleaning',                'Kitchen, bathroom and main line.',                     60, 'STARTING_AT',  129.00),
        ('summit-drain-plumbing',      'PLUMBER',     'Water heater replacement',      'Tank and tankless, permit included.',                 240, 'QUOTE_ONLY',   NULL),
        ('summit-drain-plumbing',      'PLUMBER',     'Emergency leak repair',         'Same day, outside business hours.',                   120, 'HOURLY',       195.00),
        ('mile-high-pipeworks',        'PLUMBER',     'Sewer camera inspection',       'Recorded, with a written report.',                     75, 'FLAT',         249.00),
        ('mile-high-pipeworks',        'PLUMBER',     'Repipe assessment',             'Whole-house survey and a fixed quote.',                 90, 'FLAT',          99.00),
        ('mile-high-pipeworks',        'PLUMBER',     'Burst pipe repair',             'Emergency response, billed by the hour.',              120, 'HOURLY',       175.00),
        ('cherry-creek-plumbing',      'PLUMBER',     'Fixture installation',          'Faucets, sinks and shower valves.',                     90, 'FLAT',         189.00),
        ('cherry-creek-plumbing',      'PLUMBER',     'Toilet replacement',            'Removal, install and haul-away.',                      120, 'STARTING_AT',  320.00),
        ('cherry-creek-plumbing',      'PLUMBER',     'Bathroom remodel plumbing',     'Rough-in and finish for a full remodel.',              480, 'QUOTE_ONLY',   NULL),
        ('wash-park-water-works',      'PLUMBER',     'Tankless heater service',       'Descale, flush and safety check.',                     120, 'FLAT',         210.00),
        ('wash-park-water-works',      'PLUMBER',     'Sump pump installation',        'Pump, basin and discharge line.',                      180, 'STARTING_AT',  650.00),
        ('wash-park-water-works',      'PLUMBER',     'Frozen pipe thaw',              'Winter call-out, billed by the hour.',                  90, 'HOURLY',       165.00),
        ('montbello-plumbing-heating', 'PLUMBER',     'Main line rooter service',      'Cable and jet, with a camera follow-up.',               90, 'STARTING_AT',  145.00),
        ('montbello-plumbing-heating', 'PLUMBER',     'Boiler tune-up',                'Annual service for hydronic systems.',                 120, 'FLAT',         179.00),
        ('montbello-plumbing-heating', 'HVAC',        'Furnace inspection',            'Pre-season safety and efficiency check.',               60, 'FLAT',         119.00),

        ('lodo-electric',              'ELECTRICIAN', 'Panel upgrade',                 '100A to 200A service, permit and inspection.',         480, 'QUOTE_ONLY',   NULL),
        ('lodo-electric',              'ELECTRICIAN', 'Outlet and switch install',     'Per opening, existing circuit.',                        60, 'FLAT',         145.00),
        ('lodo-electric',              'ELECTRICIAN', 'Fault troubleshooting',         'Dead circuits, tripping breakers, flickering lights.',   60, 'HOURLY',       155.00),
        ('front-range-current',        'ELECTRICIAN', 'EV charger installation',       'Level 2, up to 40 feet of run.',                       240, 'STARTING_AT',  899.00),
        ('front-range-current',        'ELECTRICIAN', 'Ceiling fan install',           'Replacement or new box.',                               90, 'FLAT',         189.00),
        ('front-range-current',        'ELECTRICIAN', 'Recessed lighting',             'Layout, cans and dimmers.',                            300, 'QUOTE_ONLY',   NULL),
        ('green-valley-electric',      'ELECTRICIAN', 'Breaker replacement',           'Single breaker, same panel.',                           60, 'FLAT',         175.00),
        ('green-valley-electric',      'ELECTRICIAN', 'Whole-home surge protection',   'Panel-mounted device, installed.',                     120, 'FLAT',         425.00),
        ('green-valley-electric',      'ELECTRICIAN', 'Electrical safety inspection',  'Room by room, with a written report.',                  90, 'STARTING_AT',  149.00),

        ('platte-river-carpentry',     'CARPENTER',   'Custom shelving',               'Designed, built and finished on site.',                240, 'QUOTE_ONLY',   NULL),
        ('platte-river-carpentry',     'CARPENTER',   'Door hanging',                  'Pre-hung or slab, per door.',                          120, 'FLAT',         245.00),
        ('platte-river-carpentry',     'CARPENTER',   'Deck repair',                   'Boards, joists and railings.',                         300, 'HOURLY',        95.00),
        ('congress-park-woodwork',     'CARPENTER',   'Cabinet refacing',              'Doors, drawer fronts and hardware.',                   480, 'QUOTE_ONLY',   NULL),
        ('congress-park-woodwork',     'CARPENTER',   'Trim and baseboard install',    'Per room, material extra.',                            240, 'STARTING_AT',  380.00),
        ('congress-park-woodwork',     'CARPENTER',   'Stair railing repair',          'Loose balusters, newels and handrails.',               180, 'FLAT',         420.00),

        -- Free, and a real row rather than a missing one: FLAT with 0.00 is the
        -- only way to say "we do this and it costs nothing", and it is the case
        -- a price formatter gets wrong.
        ('front-range-roofing',        'ROOFER',      'Roof inspection',               'Free, with photographs and a written summary.',         60, 'FLAT',           0.00),
        ('front-range-roofing',        'ROOFER',      'Hail damage assessment',        'Insurance-ready documentation.',                        90, 'FLAT',         149.00),
        ('front-range-roofing',        'ROOFER',      'Shingle replacement',           'Tear-off and full replacement.',                       480, 'QUOTE_ONLY',   NULL),
        ('high-plains-roofworks',      'ROOFER',      'Flat roof repair',              'TPO and modified bitumen.',                            300, 'STARTING_AT',  750.00),
        ('high-plains-roofworks',      'ROOFER',      'Gutter replacement',            'Seamless aluminium, per linear foot.',                 240, 'QUOTE_ONLY',   NULL),
        ('high-plains-roofworks',      'GENERAL_CONTRACTOR', 'Storm damage rebuild',   'Roof, siding and interior, managed end to end.',       480, 'QUOTE_ONLY',   NULL),

        ('five-points-auto',           'AUTO_MECHANIC', 'Oil and filter change',       'Synthetic, up to 6 quarts.',                            45, 'FLAT',          79.00),
        ('five-points-auto',           'AUTO_MECHANIC', 'Brake service',               'Pads and rotors, per axle.',                           180, 'STARTING_AT',  320.00),
        ('five-points-auto',           'AUTO_MECHANIC', 'Check engine diagnostics',    'Scan, test and a written finding.',                     60, 'FLAT',         129.00),

        ('denver-climate-control',     'HVAC',        'AC tune-up',                    'Coil clean, charge check, filter.',                     90, 'FLAT',         139.00),
        ('denver-climate-control',     'HVAC',        'Furnace replacement',           'Removal, install and permit.',                         480, 'QUOTE_ONLY',   NULL),
        ('denver-climate-control',     'HVAC',        'Thermostat install',            'Smart or conventional, wired.',                          60, 'FLAT',         165.00),

        ('capitol-hill-handyman',      'HANDYPERSON', 'Half-day of odd jobs',          'Your list, worked top to bottom.',                     240, 'HOURLY',        85.00),
        ('capitol-hill-handyman',      'HANDYPERSON', 'TV mounting',                   'Bracket, level and cable tidy.',                        60, 'FLAT',         129.00),
        ('capitol-hill-handyman',      'PAINTER',     'Interior touch-up painting',    'Patch, prime and match existing paint.',                180, 'STARTING_AT',  240.00),
        ('capitol-hill-handyman',      'CARPENTER',   'Closet build-out',              'Shelving, rods and a painted finish.',                  240, 'QUOTE_ONLY',   NULL),

        ('wash-park-landscaping',      'LANDSCAPER',  'Spring clean-up',               'Cut back, rake, edge and haul away.',                   240, 'STARTING_AT',  275.00),
        ('wash-park-landscaping',      'LANDSCAPER',  'Sprinkler blowout',             'Winterisation, up to six zones.',                        60, 'FLAT',          89.00),
        ('wash-park-landscaping',      'LANDSCAPER',  'Xeriscape design',              'Plan and planting list for a water-wise yard.',         120, 'QUOTE_ONLY',   NULL),

        ('baker-district-painting',    'PAINTER',     'Interior room repaint',         'Two coats, walls and ceiling.',                         480, 'STARTING_AT',  450.00),
        ('baker-district-painting',    'PAINTER',     'Cabinet spraying',              'Sanded, sprayed and reassembled.',                      480, 'QUOTE_ONLY',   NULL),
        ('baker-district-painting',    'PAINTER',     'Deck staining',                 'Clean, sand and two coats of stain.',                   300, 'HOURLY',        75.00),

        ('mile-high-flooring',         'FLOORING_INSTALLER', 'LVP installation',       'Underlay, planks and trim, per room.',                  480, 'STARTING_AT', 1200.00),
        ('mile-high-flooring',         'FLOORING_INSTALLER', 'Hardwood refinishing',   'Sand, stain and three coats.',                          480, 'QUOTE_ONLY',   NULL),
        ('mile-high-flooring',         'FLOORING_INSTALLER', 'Tile repair',            'Cracked tiles, grout and thresholds.',                  120, 'FLAT',         275.00),

        ('cornerstone-builders',       'GENERAL_CONTRACTOR', 'Project consultation',   'Scope, budget and a build sequence.',                    90, 'FLAT',         150.00),
        ('cornerstone-builders',       'GENERAL_CONTRACTOR', 'Basement finishing',     'Framing to final inspection.',                          480, 'QUOTE_ONLY',   NULL),
        ('cornerstone-builders',       'CARPENTER',   'Framing crew',                  'Day rate, two-person crew.',                            480, 'HOURLY',       110.00),
        ('cornerstone-builders',       'MASON',       'Foundation crack repair',       'Epoxy injection or structural repair.',                 240, 'QUOTE_ONLY',   NULL),

        ('rocky-mountain-masonry',     'MASON',       'Brick repointing',              'Grind out and repoint, per section.',                   300, 'STARTING_AT',  680.00),
        ('rocky-mountain-masonry',     'MASON',       'Chimney rebuild',               'Above the roofline, flashing included.',                480, 'QUOTE_ONLY',   NULL),
        ('rocky-mountain-masonry',     'MASON',       'Retaining wall repair',         'Re-set, re-grade and drainage.',                        360, 'HOURLY',        95.00),

        ('smart-home-installs',        'INSTALLATION_TECHNICIAN', 'Smart thermostat setup',  'Mounted, wired and connected.',                    60, 'FLAT',         149.00),
        ('smart-home-installs',        'INSTALLATION_TECHNICIAN', 'Doorbell camera install', 'Transformer check included.',                      90, 'FLAT',         189.00),
        ('smart-home-installs',        'ELECTRICIAN', 'Low-voltage wiring',            'Data, speaker and camera runs.',                        180, 'HOURLY',       125.00),

        ('ironline-fabrication',       'WELDER_FABRICATOR', 'Mobile welding call-out', 'On-site repair, MIG and stick.',                        120, 'HOURLY',       145.00),
        ('ironline-fabrication',       'WELDER_FABRICATOR', 'Handrail fabrication',    'Measured, built and installed.',                        480, 'QUOTE_ONLY',   NULL),
        ('ironline-fabrication',       'WELDER_FABRICATOR', 'Trailer hitch repair',    'Receiver, mounts and safety chains.',                    90, 'FLAT',         210.00),

        ('platte-industrial-service',  'INDUSTRIAL_MECHANIC', 'Conveyor service',      'Belts, bearings and alignment.',                        240, 'HOURLY',       165.00),
        ('platte-industrial-service',  'INDUSTRIAL_MECHANIC', 'Pump rebuild',          'Strip, measure, replace and test.',                     480, 'QUOTE_ONLY',   NULL),
        ('platte-industrial-service',  'INDUSTRIAL_MECHANIC', 'Preventive maintenance visit', 'Scheduled inspection and report.',               180, 'FLAT',         495.00),

        ('cherry-creek-arts-studio',   'ARTISAN',     'Custom metal sign',             'Designed, cut and finished to order.',                  480, 'QUOTE_ONLY',   NULL),
        ('cherry-creek-arts-studio',   'ARTISAN',     'Furniture restoration',         'Strip, repair and refinish.',                           300, 'STARTING_AT',  380.00),
        ('cherry-creek-arts-studio',   'ARTISAN',     'Stained glass repair',          'Re-leading and replacement panes.',                     180, 'HOURLY',        95.00);

    -- Licences, in all three states the search reads: verified, unverified, and
    -- expired -- the last counts for neither badge, and only exists if a row
    -- carries a date in the past. Two states for one business, because per-state
    -- licensing is why this is a table at all (V3).
    CREATE TEMP TABLE seed_license (
        slug           TEXT,
        state          TEXT,
        license_number TEXT,
        license_type   TEXT,
        issued_on      DATE,
        expires_on     DATE,
        verified       BOOLEAN
    ) ON COMMIT DROP;

    INSERT INTO seed_license VALUES
        ('summit-drain-plumbing',      'CO', 'PL-0184223',  'Master Plumber',         DATE '2019-04-01', DATE '2027-06-30', TRUE),
        ('mile-high-pipeworks',        'CO', 'PL-0197841',  'Journeyman Plumber',     DATE '2021-02-15', DATE '2026-12-31', FALSE),
        ('cherry-creek-plumbing',      'CO', 'PL-0166902',  'Master Plumber',         DATE '2017-09-01', DATE '2028-03-31', TRUE),
        -- The expired one. Verified once, and neither badge counts it today.
        ('wash-park-water-works',      'CO', 'PL-0142008',  'Journeyman Plumber',     DATE '2015-01-20', DATE '2025-01-31', TRUE),
        ('montbello-plumbing-heating', 'CO', 'PL-0173355',  'Master Plumber',         DATE '2018-06-10', DATE '2027-11-30', TRUE),
        ('montbello-plumbing-heating', 'WY', 'WY-PL-88120', 'Master Plumber',         DATE '2020-03-01', DATE '2027-03-31', FALSE),
        ('lodo-electric',              'CO', 'EL-0201477',  'Master Electrician',     DATE '2020-08-01', DATE '2028-08-31', TRUE),
        ('front-range-current',        'CO', 'EL-0219640',  'Journeyman Electrician', DATE '2022-05-01', DATE '2027-04-30', FALSE),
        ('green-valley-electric',      'CO', 'EL-0188315',  'Master Electrician',     DATE '2019-01-15', DATE '2027-09-30', TRUE),
        ('front-range-roofing',        'CO', 'RF-0093412',  'Roofing Contractor',     DATE '2021-07-01', DATE '2028-06-30', FALSE),
        ('cornerstone-builders',       'CO', 'GC-0051880',  'General Contractor B',   DATE '2016-11-01', DATE '2029-10-31', TRUE);

    -- Working hours as named schedules, in minutes since local midnight (V4).
    -- 420 = 07:00, 480 = 08:00, 540 = 09:00, 600 = 10:00, 720 = 12:00,
    -- 780 = 13:00, 960 = 16:00, 1020 = 17:00, 1080 = 18:00.
    --
    -- Four of them rather than one, because NextAvailability answers a different
    -- question for each: a lunch break splits the day into two blocks, SIX_DAY
    -- moves the next free slot across a weekend, and LATE opens on Tuesday, so
    -- somebody in the list is closed on Monday.
    CREATE TEMP TABLE seed_schedule (schedule TEXT, day_of_week INT, starts_at INT, ends_at INT) ON COMMIT DROP;

    INSERT INTO seed_schedule
    SELECT 'STANDARD', day, block.starts_at, block.ends_at
    FROM generate_series(1, 5) AS day,
         (VALUES (480, 720), (780, 1020)) AS block (starts_at, ends_at);

    INSERT INTO seed_schedule
    SELECT 'EARLY', day, 420, 960
    FROM generate_series(1, 5) AS day;

    INSERT INTO seed_schedule
    SELECT 'SIX_DAY', day, block.starts_at, block.ends_at
    FROM generate_series(1, 5) AS day,
         (VALUES (480, 720), (780, 1020)) AS block (starts_at, ends_at)
    UNION ALL
    SELECT 'SIX_DAY', 6, 540, 780;

    INSERT INTO seed_schedule
    SELECT 'LATE', day, 600, 1080
    FROM generate_series(2, 6) AS day;

    CREATE TEMP TABLE seed_policy (
        policy                            TEXT PRIMARY KEY,
        booking_horizon_days              INT,
        min_lead_time_hours               INT,
        max_accepted_appointments_per_day INT,
        slot_granularity_minutes          INT,
        appointment_buffer_minutes        INT
    ) ON COMMIT DROP;

    INSERT INTO seed_policy VALUES
        ('STANDARD', 60, 24,    4, 30, 30),
        ('FAST',     30,  4,    6, 15, 15),
        -- NULL is "unlimited", and this is the row that exercises it.
        ('PROJECT', 120, 72, NULL, 60, 60);

    -- =======================================================================
    -- The inserts. The order is the foreign keys: owner, profile, trades, and
    -- only then services -- the composite key checks those against
    -- business_trade, so the links have to be in first.
    -- =======================================================================

    INSERT INTO identity_user (id, workos_user_id, email, created_at, updated_at, version)
    SELECT md5('tradeties.seed.owner:' || slug)::uuid,
           'dev_seed_marketplace:' || slug,
           'owner@' || slug || '.example',
           now_utc, now_utc, 0
    FROM seed_business;

    INSERT INTO identity_user_role (user_id, role)
    SELECT md5('tradeties.seed.owner:' || slug)::uuid, 'BUSINESS_OWNER'
    FROM seed_business;

    -- Coordinates come from zip_centroid rather than being pasted in, for the
    -- reason dev-seed.sql looks trades up by code: a copy stops matching the day
    -- R__zip_centroid.sql is regenerated from a newer Census vintage.
    --
    -- geocode_precision has to travel with them or V11 rejects the row, and ZIP
    -- is the truth here -- these are centroids, not addresses anybody geocoded.
    -- geocode_attempted_at stays null, which reads as "never looked at": the
    -- background refiner will sharpen these to STREET on its own, and the points
    -- move a few hundred metres when it does.
    INSERT INTO business_profile (
        id, owner_user_id, slug, legal_name, display_name, description, website_url,
        phone, email, street1, city, state, postal_code, latitude, longitude,
        geocode_precision, time_zone, service_radius_miles, status,
        onboarding_completed_step, first_published_at, created_at, updated_at, version)
    SELECT md5('tradeties.seed.business:' || b.slug)::uuid,
           md5('tradeties.seed.owner:' || b.slug)::uuid,
           b.slug,
           b.display_name || ' LLC',
           b.display_name,
           b.description,
           'https://' || b.slug || '.example',
           -- Numbered rather than listed: 24 hand-written phone numbers are 24
           -- chances to paste the same one twice.
           '+1303555' || lpad((row_number() OVER (ORDER BY b.slug))::text, 4, '0'),
           'dispatch@' || b.slug || '.example',
           b.street1, 'Denver', 'CO', b.postal_code,
           z.latitude, z.longitude, 'ZIP',
           'America/Denver', b.service_radius_miles, 'PUBLISHED', 9,
           now_utc - INTERVAL '30 days', now_utc, now_utc, 0
    FROM seed_business b
    JOIN zip_centroid z ON z.zip = b.postal_code;

    INSERT INTO business_trade (business_id, trade_id, is_primary)
    SELECT md5('tradeties.seed.business:' || b.slug)::uuid, t.id, TRUE
    FROM seed_business b
    JOIN trade t ON t.code = b.trade_code;

    INSERT INTO business_trade (business_id, trade_id, is_primary)
    SELECT md5('tradeties.seed.business:' || s.slug)::uuid, t.id, FALSE
    FROM seed_secondary_trade s
    JOIN trade t ON t.code = s.trade_code;

    INSERT INTO business_pricing (
        business_id, currency, hourly_rate, minimum_billable_minutes,
        billing_increment_minutes, service_call_fee, service_call_fee_waived_if_hired,
        travel_fee_mode, travel_flat_fee, travel_rate_per_mile,
        material_pricing_mode, material_markup_percent,
        cancellation_fee, cancellation_notice_hours, created_at, updated_at, version)
    SELECT md5('tradeties.seed.business:' || p.slug)::uuid, 'USD', p.hourly_rate, 60, 15,
           p.service_call_fee, p.fee_waived_if_hired,
           p.travel_fee_mode, p.travel_flat_fee, p.travel_rate_per_mile,
           p.material_pricing_mode, p.material_markup_percent,
           p.cancellation_fee, p.cancellation_notice_hours, now_utc, now_utc, 0
    FROM seed_pricing p;

    INSERT INTO business_service (
        id, business_id, trade_id, name, description, estimated_duration_minutes,
        pricing_mode, price, active, sort_order, created_at, updated_at, version)
    SELECT md5('tradeties.seed.service:' || s.slug || ':' || lower(s.name))::uuid,
           md5('tradeties.seed.business:' || s.slug)::uuid,
           t.id, s.name, s.description, s.minutes, s.pricing_mode, s.price, TRUE,
           (row_number() OVER (PARTITION BY s.slug ORDER BY s.name))::int * 10,
           now_utc, now_utc, 0
    FROM seed_service s
    JOIN trade t ON t.code = s.trade_code;

    -- verified_at is a statement about this exact row: change the state, the
    -- number or the type and it has to be cleared in the same UPDATE.
    INSERT INTO business_license (
        id, business_id, state, license_number, license_type,
        issued_on, expires_on, verified_at, created_at, updated_at, version)
    SELECT md5('tradeties.seed.license:' || l.slug || ':' || l.state || ':' || l.license_number)::uuid,
           md5('tradeties.seed.business:' || l.slug)::uuid,
           l.state, l.license_number, l.license_type, l.issued_on, l.expires_on,
           CASE WHEN l.verified THEN now_utc - INTERVAL '14 days' END,
           now_utc, now_utc, 0
    FROM seed_license l;

    INSERT INTO availability_working_hours (id, business_id, day_of_week, starts_at, ends_at)
    SELECT md5('tradeties.seed.hours:' || b.slug || ':' || s.day_of_week || ':' || s.starts_at)::uuid,
           md5('tradeties.seed.business:' || b.slug)::uuid,
           s.day_of_week, s.starts_at, s.ends_at
    FROM seed_business b
    JOIN seed_schedule s ON s.schedule = b.schedule;

    -- Seeded rather than left to the application, which provisions it on first
    -- use: without it, a seeded business's first booking behaves differently
    -- from every later one.
    INSERT INTO availability_booking_policy (
        business_id, booking_horizon_days, min_lead_time_hours,
        max_accepted_appointments_per_day, slot_granularity_minutes,
        appointment_buffer_minutes, created_at, updated_at, version)
    SELECT md5('tradeties.seed.business:' || b.slug)::uuid,
           p.booking_horizon_days, p.min_lead_time_hours,
           p.max_accepted_appointments_per_day, p.slot_granularity_minutes,
           p.appointment_buffer_minutes, now_utc, now_utc, 0
    FROM seed_business b
    JOIN seed_policy p ON p.policy = b.policy;

    RAISE NOTICE 'Seeded % marketplace businesses across % ZIP codes.',
        (SELECT count(*) FROM seed_business),
        (SELECT count(DISTINCT postal_code) FROM seed_business);
END $$;
