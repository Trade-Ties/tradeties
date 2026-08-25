-- ---------------------------------------------------------------------------
-- When the time zone select stopped offering every zone in the country.
--
-- V5 seeded all 29 IANA zones for the United States. The extra 23 are
-- exceptions -- Arizona, Indiana county by county, five ids for Alaska, the
-- western Aleutians -- and a list that opens with 29 entries makes the ordinary
-- case harder for everybody in order to reach the rare one. Six are left: the
-- ones that cover almost every business there is.
--
-- Here rather than in V5, although V5 is where the list was written. That file
-- has already run, and Flyway recorded its checksum when it did, so rewriting
-- it now would leave every database that applied it refusing to start with a
-- checksum mismatch. The tests would not catch that: Testcontainers starts an
-- empty database on every run, where a rewritten V5 and an appended V9 are
-- indistinguishable. A migration that has run is history, and history is
-- appended to.
--
-- The one that costs something: America/Phoenix. Arizona does not observe
-- daylight saving, so an Arizona business moved to America/Denver below has its
-- working hours land an hour off for two thirds of the year. That is a known
-- gap rather than an oversight -- and any of the rows dropped here is a
-- one-line INSERT in a later migration on the day somebody asks for one.
-- ---------------------------------------------------------------------------
-- Profiles sitting on a zone that is about to go, moved to the zone it is an
-- exception to.
--
-- business_profile.time_zone is a foreign key onto this table with no delete
-- action, so without this the DELETE below fails -- and it fails during a
-- deploy, which is the one moment at which nobody can look at the row it
-- tripped over.
--
-- Each retired zone has exactly one zone it is an exception to, which is what
-- makes this a mapping rather than a decision. The exception is Phoenix, which
-- is the decision named above.
UPDATE business_profile AS p
SET
    time_zone = m.kept
FROM
    (
        VALUES
            -- Eastern: Michigan, both Kentucky ids, and the seven Indiana
            -- counties that stayed on Eastern.
            ('America/Detroit', 'America/New_York'),
            ('America/Kentucky/Louisville', 'America/New_York'),
            ('America/Kentucky/Monticello', 'America/New_York'),
            ('America/Indiana/Indianapolis', 'America/New_York'),
            ('America/Indiana/Vincennes', 'America/New_York'),
            ('America/Indiana/Winamac', 'America/New_York'),
            ('America/Indiana/Marengo', 'America/New_York'),
            ('America/Indiana/Petersburg', 'America/New_York'),
            ('America/Indiana/Vevay', 'America/New_York'),
            -- Central: the two Indiana counties that did not, the Michigan
            -- strip on the Wisconsin border, and the three North Dakota ids.
            ('America/Indiana/Tell_City', 'America/Chicago'),
            ('America/Indiana/Knox', 'America/Chicago'),
            ('America/Menominee', 'America/Chicago'),
            ('America/North_Dakota/Center', 'America/Chicago'),
            ('America/North_Dakota/New_Salem', 'America/Chicago'),
            ('America/North_Dakota/Beulah', 'America/Chicago'),
            -- Mountain. Boise is a boundary id and moves without consequence;
            -- Phoenix is the one that does not.
            ('America/Boise', 'America/Denver'),
            ('America/Phoenix', 'America/Denver'),
            -- Alaska, which is one zone under five more ids.
            ('America/Juneau', 'America/Anchorage'),
            ('America/Sitka', 'America/Anchorage'),
            ('America/Metlakatla', 'America/Anchorage'),
            ('America/Yakutat', 'America/Anchorage'),
            ('America/Nome', 'America/Anchorage'),
            -- Adak keeps Hawaii-Aleutian time rather than Alaska time, so it
            -- lands with Honolulu and not with Anchorage.
            ('America/Adak', 'Pacific/Honolulu')
    ) AS m (retired, kept)
WHERE
    p.time_zone = m.retired;

-- Nothing references these any more, which the statement above has just made
-- true. The list of what stays is spelled out rather than derived, because it
-- is the answer to "which zones does the marketplace serve" and that is worth
-- reading in one line.
DELETE FROM time_zone
WHERE
    code NOT IN (
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu'
    );

-- sort_order runs east to west in steps of ten, so a zone can be slotted back
-- in without renumbering. Alphabetical order would open the list with Alaska.
--
-- All six restated rather than only the three that move: the finished list is
-- then readable here, instead of only as a diff against V5. Honolulu's name
-- loses its "- Hawaii" qualifier along the way -- there is no second
-- Hawaii-Aleutian entry left to tell it apart from.
UPDATE time_zone AS z
SET
    display_name = v.display_name,
    sort_order = v.sort_order
FROM
    (
        VALUES
            ('America/New_York', 'Eastern Time', 10),
            ('America/Chicago', 'Central Time', 20),
            ('America/Denver', 'Mountain Time', 30),
            ('America/Los_Angeles', 'Pacific Time', 40),
            ('America/Anchorage', 'Alaska Time', 50),
            ('Pacific/Honolulu', 'Hawaii-Aleutian Time (no daylight saving)', 60)
    ) AS v (code, display_name, sort_order)
WHERE
    z.code = v.code;
