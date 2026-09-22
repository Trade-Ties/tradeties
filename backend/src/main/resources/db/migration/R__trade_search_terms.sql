-- ---------------------------------------------------------------------------
-- What a customer might type, per trade.
--
-- This is editorial content, not schema. It changes when somebody learns how
-- people actually describe a problem, which is a different rhythm from the
-- catalogue in R__trade_reference_data.sql -- that file owns which trades
-- exist, this one owns how each is recognised. Repeatable, so a better phrase
-- is a one-line diff and a redeploy.
--
-- Runs after the catalogue: Flyway orders repeatable migrations by description,
-- and "trade reference data" sorts before "trade search terms". Any trade
-- missing here simply keeps NULL and is still matched on its display name.
--
-- The placeholders in frontend/components/marketing/job-suggestions.ts seeded
-- the first version of this file and are still shown to the customer, but they
-- are no longer the same copy and do not have to agree.
--
-- SIX TRADES HAVE NOTHING YET, and that is visible rather than hidden. There is
-- no phrasing for AUTO_MECHANIC, HANDYPERSON, INSTALLATION_TECHNICIAN,
-- WELDER_FABRICATOR, INDUSTRIAL_MECHANIC or ARTISAN. Those six match on their
-- name alone until somebody writes the words -- which is product work and
-- belongs to whoever knows what those customers say, not to whoever wrote the
-- query.
--
-- HOW TO WRITE A GOOD LINE. Words a customer would use, not words a trade
-- would. "No hot water" earns its place; "hydronic system diagnostics" does
-- not, because nobody with a cold shower types that. Include the symptom and
-- the object -- "leaking", "faucet" -- since either alone may be all the
-- description contains. Stemming handles the endings, so there is no reason to
-- write leak, leaks and leaking. Stop words carry nothing: "No hot water"
-- reaches the index as hot and water, so the content words have to stand on
-- their own.
--
-- KEEP THE LINES THE SAME LENGTH. This is the rule that breaks the file
-- quietly. ts_rank is called without a normalisation flag, so it does not
-- divide by document length: a trade with twice the vocabulary scores higher on
-- the same description simply for being longer, and wins every ambiguous match
-- in the marketplace. Every line below stems to between 48 and 64 lexemes, and
-- that band is the thing to preserve. Adding a word to one trade is free;
-- adding fifteen is a decision about all of them.
--
-- DROP THE GENERIC VERBS. "repair", "install", "replacement", "quote" and
-- "work" sit under every trade, so they raise all of them together and separate
-- none -- while still lifting whoever carries them above the six trades that
-- have no words at all. The object noun discriminates; the verb around it is
-- padding that costs precision.
--
-- REPETITION IS THE LEVER, not length. ts_rank counts occurrences, so a trade
-- takes a contested word by using it more often rather than by the others
-- giving it up: "water" appears three times under Plumber and once under
-- Roofer, and that is what settles "water is coming through the ceiling"
-- without taking the word away from either.
--
-- THE OVERLAPS BELOW ARE DELIBERATE. cabinet is Carpenter and Painter, roof is
-- Carpenter and Roofer, screed is Mason and Flooring, patio is Mason and
-- Landscaper. The matcher answers with up to three trades precisely because
-- some descriptions really are ambiguous, and hiding that makes the customer
-- choose blind. Plumber against HVAC is the one border drawn hard: hot water
-- and the water heater are Plumber's, the boiler, radiators, heat pump and
-- underfloor heating are HVAC's, and "hot" is kept out of HVAC on purpose so
-- that "no hot water" does not drift towards the heating engineer.
-- ---------------------------------------------------------------------------
UPDATE trade t
SET
    search_terms = v.terms
FROM
    (
        VALUES
            (
                'PLUMBER',
                'Leaking faucet or tap. Dripping shower head. No hot water. Water heater. Clogged drain and blocked toilet. Slow draining sink. Running cistern. Toilet not flushing. Low water pressure. Burst or frozen pipe. Water leak under the sink. Wet patch and damp smell from a pipe. Sewer, waste and drainage pipe. Unblock a drain. New basin, bathtub, shower tray or urinal. Mixer tap and shut-off valve. Washing machine and dishwasher connection. Water softener, filter and pressure reducer. Limescale. Sump pump and lifting station. Backflow and non-return valve. Bathroom sanitary fittings. Plumbing.'
            ),
            (
                'ELECTRICIAN',
                'Outlet or socket not working. Light switch broken. Breaker keeps tripping. Blown fuse and consumer unit. Panel upgrade. No power in the house. Flickering lights. Light fitting, downlights and dimmer. Ceiling fan. Rewiring, extra sockets and new circuits. Burning smell or sparking. Short circuit. RCD and earthing. Electrical safety inspection. Doorbell and intercom. Smoke alarm and motion sensor. Network, data and TV cabling. Smart home automation. Electric gate and roller shutter motor. EV charger and wallbox. Solar panels, inverter and battery. Cooker and oven connection. Electrics and wiring.'
            ),
            (
                'HVAC',
                'Heating not working. Boiler or furnace will not start. No heat in the house. Radiators stay cold. Bleeding a radiator. Radiator replacement. Underfloor heating. Heat pump install and service. Thermostat not responding. Boiler service and annual tune-up. Pilot light out. Balancing and heating curve. Air conditioning not cooling. Aircon and split unit. Refrigerant top-up and leak test. Condensate. Ventilation and airflow. Extractor fan and air vents. Ducting. Heat recovery and supply air. Filter change. Strange noise from the unit. Flue and gas appliance. HVAC and climate control.'
            ),
            (
                'CARPENTER',
                'Door will not close or sticks. Internal door, frame and lining. Broken cabinet hinge. Kitchen units and worktop fitted. Built-in wardrobe and fitted cupboard. Shelving and bookcase. Skirting board, architrave and trim. Stud wall and partition. Timber joists, beams and posts. Roof truss and rafters. Rotten or sagging floorboards. Squeaky stairs. Staircase, banister and handrail. Decking, pergola and carport. Loft hatch and boarding. Wooden window frame. Custom furniture and made to measure. Woodwork, joinery and carpentry.'
            ),
            (
                'PAINTER',
                'Repaint the walls and ceiling. Fresh coat of paint. Peeling, flaking and blistering paintwork. Filling holes and sanding before painting. Primer and undercoat. Gloss, satin and eggshell finish. Stripping old wallpaper. Wallpapering and lining paper. Water stains on the ceiling. Nicotine and soot marks. Interior and exterior decorating. Facade painting and protective coating. Fence and shed staining. Varnish and wood stain. Spray finish and cabinet refinishing. Colour match and touch-up. Anti-mould coating. Epoxy resin coating. Painter and decorator.'
            ),
            (
                'ROOFER',
                'Roof leak. Water coming through the ceiling. Missing or slipped tiles and slates. Broken shingles. Loose ridge tiles. Flashing around the chimney. Flat roof felt, EPDM and membrane. Gutters and downpipes blocked or leaking. Fascia and soffit. Moss and roof cleaning. Skylight and roof window. Dormer. Storm and wind damage. Sagging roof. Loft and attic insulation. Leadwork, valley and verge. Eaves and battens. Breather and vapour membrane. Snow guard and roof anchor. Roof inspection and survey. Re-roofing and reroof. Roofing and roofer.'
            ),
            (
                'LANDSCAPER',
                'Lawn mowing and new turf. Overgrown garden clearance. Hedge trimming and pruning. Tree removal and cutting back branches. Weeding and planting. Flower beds, borders and shrubs. Mulch, bark and topsoil. Patio and paving slabs. Garden path and gravel. Fence panels and posts. Trellis and screening. Irrigation and sprinkler system. Garden drainage and soakaway. Pond and water feature. Outdoor lighting. Regrading and terracing the ground. Leaf clearing and snow. Yard and garden maintenance. Landscaping and gardener.'
            ),
            (
                'MASON',
                'Cracked brickwork and mortar. Repointing. Rebuild a garden or retaining wall. Blockwork and stonework. Natural stone and brick cladding. Rendering and plaster repair. Chimney rebuild. Concrete steps and slab. Foundation and footing crack. Lintel over a doorway. New opening in a wall. Damp proof course and tanking. Cavity wall. Spalling and crumbling bricks. Screed and sub-base concrete. Kerbs, edging and paving stones. Formwork and reinforcement. Small demolition and rebuild. Bricklaying, masonry and bricklayer.'
            ),
            (
                'FLOORING_INSTALLER',
                'New laminate, vinyl and LVT flooring. Carpet and carpet tiles fitted. Linoleum and cork. Acoustic underlay. Levelling an uneven subfloor. Self-levelling compound over screed. Damp proof membrane under the floor. Hardwood, engineered wood and parquet. Sanding, oiling and sealing floorboards. Floor tiles laid. Lifting or bubbling vinyl. Gaps and worn boards replaced. Threshold strip, beading and transition profile. Squeaky subfloor. Scratched and worn wood floor. Moisture test before laying. Floor refinishing and floor fitting. Floor layer.'
            ),
            (
                'GENERAL_CONTRACTOR',
                'Bathroom and kitchen remodel. House extension and room addition. Loft, garage and basement conversion. Open plan knock through. Whole house refurbishment and renovation. Several trades on one job. Complete refit and fit-out. Turnkey and project management. Coordinating subcontractors on site. Planning permission and building regulations. Building control sign-off. Structural steel beam and RSJ. Snagging list and handover. Several rooms at once. Fixed price for the whole job. Main contractor and builder.'
            )
    ) AS v (code, terms)
WHERE
    t.code = v.code;
