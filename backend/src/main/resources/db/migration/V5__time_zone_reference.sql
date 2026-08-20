-- ---------------------------------------------------------------------------
-- The time zones a business can operate in.
--
-- Same shape and same reasoning as `us_state` in V3: the wizard needs exactly
-- this list for its select in step 2 and should not carry a second copy in the
-- frontend, and a foreign key violation names the column and the offending
-- value where a CHECK would only say that a constraint failed.
--
-- Unlike `us_state`, a table here is not a preference but the only option.
-- PostgreSQL knows every zone in pg_timezone_names, but a CHECK cannot query a
-- table, and a function that did could not honestly be marked IMMUTABLE --
-- which zone ids are valid changes with every tzdata update. A 600-line
-- CHECK (time_zone IN (...)) is the alternative, and it is not one.
--
-- WHY THIS MATTERS MORE THAN IT LOOKS. Working hours are stored as local wall
-- clock (V4), and this column is what turns them into instants. An unusable
-- value is therefore not a cosmetic problem: it breaks the calculation of every
-- free slot for that one business, months after the profile was saved and in a
-- completely different endpoint. Before this migration the column accepted
-- 'Europe/Zurich123' without a word.
--
-- Versioned rather than repeatable, unlike `trade`: the set of US time zones
-- does not grow with market demand. It changes when the IANA database changes,
-- which for the United States is a once-a-decade event, and then it is a
-- one-line migration.
--
-- Territories (PR, VI, GU, AS, MP) are left out, exactly as they are in
-- `us_state` -- adding America/Puerto_Rico and Pacific/Guam is a two-line
-- migration on the day the profile list grows to match.
--
-- sort_order puts the seven zones that cover almost everybody first, then the
-- exceptions, in steps of ten so one can be slotted in without renumbering.
-- Alphabetical order would open the select with America/Adak, which serves
-- roughly a hundred people.
-- ---------------------------------------------------------------------------
CREATE TABLE
    time_zone (
        code VARCHAR(64) NOT NULL, -- IANA id, e.g. America/Denver
        display_name VARCHAR(80) NOT NULL, -- what the select shows
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (code)
    );

INSERT INTO
    time_zone (code, display_name, sort_order)
VALUES
    -- The seven that cover almost every business.
    ('America/New_York', 'Eastern Time', 10),
    ('America/Chicago', 'Central Time', 20),
    ('America/Denver', 'Mountain Time', 30),
    (
        'America/Phoenix',
        'Mountain Time - Arizona (no daylight saving)',
        40
    ),
    ('America/Los_Angeles', 'Pacific Time', 50),
    ('America/Anchorage', 'Alaska Time', 60),
    (
        'Pacific/Honolulu',
        'Hawaii-Aleutian Time - Hawaii (no daylight saving)',
        70
    ),
    -- Eastern exceptions. Indiana is split across two zones and six ids, which
    -- is why a state-to-zone mapping cannot be the answer and the wizard has to
    -- have the tradesperson confirm it.
    ('America/Detroit', 'Eastern Time - Michigan', 80),
    (
        'America/Kentucky/Louisville',
        'Eastern Time - Kentucky (Louisville area)',
        90
    ),
    (
        'America/Kentucky/Monticello',
        'Eastern Time - Kentucky (Wayne County)',
        100
    ),
    (
        'America/Indiana/Indianapolis',
        'Eastern Time - Indiana (most areas)',
        110
    ),
    (
        'America/Indiana/Vincennes',
        'Eastern Time - Indiana (Daviess, Dubois, Knox, Martin)',
        120
    ),
    (
        'America/Indiana/Winamac',
        'Eastern Time - Indiana (Pulaski)',
        130
    ),
    (
        'America/Indiana/Marengo',
        'Eastern Time - Indiana (Crawford)',
        140
    ),
    (
        'America/Indiana/Petersburg',
        'Eastern Time - Indiana (Pike)',
        150
    ),
    (
        'America/Indiana/Vevay',
        'Eastern Time - Indiana (Switzerland County)',
        160
    ),
    -- Central exceptions.
    (
        'America/Indiana/Tell_City',
        'Central Time - Indiana (Perry)',
        170
    ),
    (
        'America/Indiana/Knox',
        'Central Time - Indiana (Starke)',
        180
    ),
    (
        'America/Menominee',
        'Central Time - Michigan (Wisconsin border)',
        190
    ),
    (
        'America/North_Dakota/Center',
        'Central Time - North Dakota (Oliver)',
        200
    ),
    (
        'America/North_Dakota/New_Salem',
        'Central Time - North Dakota (Morton, rural)',
        210
    ),
    (
        'America/North_Dakota/Beulah',
        'Central Time - North Dakota (Mercer)',
        220
    ),
    -- Mountain exception.
    (
        'America/Boise',
        'Mountain Time - Idaho (south), Oregon (east)',
        230
    ),
    -- Alaska exceptions. Five ids beside America/Anchorage, and Adak is not
    -- even on Alaska time -- it keeps Hawaii-Aleutian.
    ('America/Juneau', 'Alaska Time - Juneau', 240),
    ('America/Sitka', 'Alaska Time - Sitka', 250),
    (
        'America/Metlakatla',
        'Alaska Time - Annette Island',
        260
    ),
    ('America/Yakutat', 'Alaska Time - Yakutat', 270),
    ('America/Nome', 'Alaska Time - Nome', 280),
    (
        'America/Adak',
        'Hawaii-Aleutian Time - Western Aleutians',
        290
    );

-- The point of the whole file. Safe to add without a data fix: nothing is
-- deployed yet, and every value written so far came from the wizard's own
-- select.
ALTER TABLE business_profile ADD CONSTRAINT business_profile_time_zone_fkey FOREIGN KEY (time_zone) REFERENCES time_zone (code);
