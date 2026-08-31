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
-- WHERE THESE CAME FROM. Lifted from frontend/components/marketing/
-- job-suggestions.ts, which was written as placeholder text for the search box
-- and says in its own header that it was being kept for exactly this. It is not
-- deleted there -- the placeholders are still shown to the customer -- but this
-- is now the copy the matching reads, and the two do not have to agree.
--
-- SIX TRADES HAVE NOTHING YET, and that is visible rather than hidden. The
-- frontend file predates the current catalogue: it carries a Locksmith the
-- marketplace does not offer and an "Other" bucket that is not a trade, and it
-- has no phrasing for AUTO_MECHANIC, HANDYPERSON, INSTALLATION_TECHNICIAN,
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
-- write leak, leaks and leaking.
--
-- A word that fits several trades costs precision everywhere it appears:
-- "cabinet" sits under Carpenter and Painter, and a sentence containing it
-- scores them level. That is not a bug to remove -- some descriptions really
-- are ambiguous -- but it is a reason not to pad these lines.
-- ---------------------------------------------------------------------------
UPDATE trade t
SET
    search_terms = v.terms
FROM
    (
        VALUES
            (
                'PLUMBER',
                'Leaking faucet. No hot water. Clogged drain. Running toilet. Low water pressure. Burst pipe. Water heater.'
            ),
            (
                'ELECTRICIAN',
                'Outlet not working. Breaker keeps tripping. Flickering lights. Ceiling fan install. No power in a room. Panel upgrade. Wiring.'
            ),
            (
                'HVAC',
                'Furnace will not start. AC not cooling. Thermostat not responding. Strange noise from unit. No airflow. Annual tune-up. Heating. Air conditioning.'
            ),
            (
                'CARPENTER',
                'Broken cabinet hinge. Squeaky floor. Deck repair. Door will not close. Shelving install. Trim work. Woodwork.'
            ),
            (
                'PAINTER',
                'Interior room repaint. Peeling paint. Water-stained ceiling. Exterior touch-up. Cabinet refinishing. Fence staining.'
            ),
            (
                'ROOFER',
                'Roof leak. Missing shingles. Gutter repair. Storm damage. Roof inspection. Replacement quote.'
            ),
            (
                'LANDSCAPER',
                'Lawn mowing. Seasonal cleanup. Tree trimming. Sprinkler repair. Hedge trimming. Mulching. Yard. Garden.'
            ),
            (
                'MASON',
                'Cracked concrete. Brick repair. Retaining wall. Chimney repair. Patio install. Foundation crack. Stonework.'
            ),
            (
                'FLOORING_INSTALLER',
                'Damaged hardwood boards. Tile installation. Carpet replacement. Squeaky subfloor. Laminate install. Floor refinishing.'
            ),
            (
                'GENERAL_CONTRACTOR',
                'Bathroom remodel. Kitchen remodel. Room addition. Basement finishing. Permit-ready renovation. General repairs.'
            )
    ) AS v (code, terms)
WHERE
    t.code = v.code;
