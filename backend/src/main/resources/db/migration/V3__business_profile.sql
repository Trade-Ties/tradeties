-- ---------------------------------------------------------------------------
-- Module `business`: the tradesperson's shop.
--
-- One aggregate root (business_profile) with five satellites. The split follows
-- lifecycle, not normalisation: business_pricing is its own table because
-- DECISIONS section 1 snapshots exactly that block onto a request. It is read
-- on every send and changes on a different rhythm than the profile does.
--
-- Deliberately NOT partitioned. GENERAL_DATAMODEL proposes PARTITION BY LIST
-- (state) eventually. PostgreSQL would then require `state` in every primary
-- and unique key, which pushes composite ids through the entire Java model --
-- and it would cost `slug` its global uniqueness, since a unique index cannot
-- span partitions. The whole addressable market is a few hundred thousand
-- businesses, and converting later costs the same, so it is not paid now.
--
-- Deliberately NOT PostGIS. latitude/longitude stay NUMERIC until the search
-- slice; the geography(Point,4326) column plus GiST index is purely additive,
-- and until then every test run stays on the slim postgres image
-- (DECISIONS section 6).
-- ---------------------------------------------------------------------------
-- Required by V4's exclusion constraint on working hours, which combines
-- equality (business_id, day_of_week) with range overlap in one constraint --
-- something plain GiST cannot express. Created here so it is in place before
-- V4 runs; nothing in V3 itself uses it.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The 50 states plus DC, as a table rather than a CHECK constraint.
--
-- Two reasons. The wizard needs exactly this list for its state selects in
-- steps 2 and 6 and should not carry a second copy in the frontend; and a
-- foreign key violation names the column and the offending value, where a
-- 51-branch CHECK just says the constraint failed.
--
-- Seeded here rather than in a repeatable migration, unlike `trade`: the set of
-- US states does not grow with market demand.
--
-- DC is included although WIZARD says "the 50 states". DC/MD/VA is one labour
-- market, and a contractor licensed in the District would otherwise have no
-- state to pick. Territories (PR, VI, GU, AS, MP) are left out until there is a
-- reason -- adding a row is a one-line migration.
CREATE TABLE
    us_state (
        code CHAR(2) NOT NULL,
        name VARCHAR(64) NOT NULL,
        PRIMARY KEY (code)
    );

INSERT INTO
    us_state (code, name)
VALUES
    ('AL', 'Alabama'),
    ('AK', 'Alaska'),
    ('AZ', 'Arizona'),
    ('AR', 'Arkansas'),
    ('CA', 'California'),
    ('CO', 'Colorado'),
    ('CT', 'Connecticut'),
    ('DE', 'Delaware'),
    ('DC', 'District of Columbia'),
    ('FL', 'Florida'),
    ('GA', 'Georgia'),
    ('HI', 'Hawaii'),
    ('ID', 'Idaho'),
    ('IL', 'Illinois'),
    ('IN', 'Indiana'),
    ('IA', 'Iowa'),
    ('KS', 'Kansas'),
    ('KY', 'Kentucky'),
    ('LA', 'Louisiana'),
    ('ME', 'Maine'),
    ('MD', 'Maryland'),
    ('MA', 'Massachusetts'),
    ('MI', 'Michigan'),
    ('MN', 'Minnesota'),
    ('MS', 'Mississippi'),
    ('MO', 'Missouri'),
    ('MT', 'Montana'),
    ('NE', 'Nebraska'),
    ('NV', 'Nevada'),
    ('NH', 'New Hampshire'),
    ('NJ', 'New Jersey'),
    ('NM', 'New Mexico'),
    ('NY', 'New York'),
    ('NC', 'North Carolina'),
    ('ND', 'North Dakota'),
    ('OH', 'Ohio'),
    ('OK', 'Oklahoma'),
    ('OR', 'Oregon'),
    ('PA', 'Pennsylvania'),
    ('RI', 'Rhode Island'),
    ('SC', 'South Carolina'),
    ('SD', 'South Dakota'),
    ('TN', 'Tennessee'),
    ('TX', 'Texas'),
    ('UT', 'Utah'),
    ('VT', 'Vermont'),
    ('VA', 'Virginia'),
    ('WA', 'Washington'),
    ('WV', 'West Virginia'),
    ('WI', 'Wisconsin'),
    ('WY', 'Wyoming');

-- Structure only -- the rows live in R__trade_reference_data.sql, because the
-- list grows with market demand rather than with deploys, and the search needs
-- it as a facet. Unlike Role in V2, which is a closed set with security meaning
-- and therefore belongs in code.
CREATE TABLE
    trade (
        id UUID NOT NULL,
        code VARCHAR(64) NOT NULL,
        display_name VARCHAR(120) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (id)
    );

-- The natural key the repeatable migration upserts on, and the key
-- business_trade rows survive a re-run by.
CREATE UNIQUE INDEX trade_by_code_uidx ON trade (code);

CREATE TABLE
    business_profile (
        id UUID NOT NULL,
        owner_user_id UUID NOT NULL REFERENCES identity_user (id),
        slug VARCHAR(80) NOT NULL, -- /pro/joes-plumbing
        legal_name VARCHAR(200) NOT NULL, -- "Joe's Plumbing LLC"
        display_name VARCHAR(200) NOT NULL, -- "Joe's Plumbing"
        -- Bounded rather than TEXT, although the two are the same type internally
        -- and the bound is therefore free. The contract already caps it at 2000
        -- and rejects longer input with a 400; this stops everything that does not
        -- come through the contract -- a migration, a script, a second writer.
        -- Keep the number in step with maxLength in api/openapi.yaml.
        description VARCHAR(2000),
        website_url VARCHAR(2048),
        -- Business contact, NOT the login. Someone signs in as joe@gmail.com and
        -- publishes dispatch@joesplumbing.com. Merging the two would mean that
        -- swapping the identity provider touches the public phone number -- exactly
        -- the coupling DECISIONS section 7 avoids.
        phone VARCHAR(16) NOT NULL, -- E.164
        email VARCHAR(320) NOT NULL,
        street1 VARCHAR(200) NOT NULL,
        street2 VARCHAR(200),
        city VARCHAR(100) NOT NULL,
        state CHAR(2) NOT NULL REFERENCES us_state (code),
        postal_code VARCHAR(10) NOT NULL, -- ZIP or ZIP+4
        latitude NUMERIC(9, 6),
        longitude NUMERIC(9, 6),
        time_zone VARCHAR(64) NOT NULL, -- IANA, e.g. America/Denver
        service_radius_miles INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL,
        -- Where the onboarding wizard resumes. Deriving this from the data does not
        -- work: zero availability_working_hours rows means "step 7 not done yet" or
        -- "closed all week", and a business_pricing row full of defaults means "not
        -- filled in" or "defaults accepted on purpose". Both readings are wrong
        -- half the time.
        --
        -- Starts at 2 because the profile does not exist before step 2 -- street,
        -- city, state, postal code, time zone and radius are all NOT NULL, so
        -- nothing can be persisted until the address is in. Step 1 therefore lives
        -- in the browser until step 2 is saved.
        --
        -- Advisory only. Nothing but the wizard reads it, and publishing is gated
        -- by the completeness check in the publish service, never by this number.
        onboarding_completed_step SMALLINT NOT NULL,
        created_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            updated_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            version BIGINT NOT NULL,
            PRIMARY KEY (id),
            CHECK (service_radius_miles BETWEEN 1 AND 500),
            CHECK (status IN ('DRAFT', 'PUBLISHED', 'SUSPENDED')),
            CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
            CHECK (onboarding_completed_step BETWEEN 2 AND 9),
            CHECK (
                latitude IS NULL
                OR latitude BETWEEN -90 AND 90
            ),
            CHECK (
                longitude IS NULL
                OR longitude BETWEEN -180 AND 180
            ),
            -- A half-geocoded address is worthless, and it would surface only in the
            -- radius search, where it silently drops the profile out of the results.
            CHECK ((latitude IS NULL) = (longitude IS NULL))
    );

CREATE UNIQUE INDEX business_profile_by_slug_uidx ON business_profile (slug);

-- "One account, one business" (DECISIONS section 1), as a constraint rather
-- than an intention. Dropping a unique index later is migration-free; adding
-- one to a table that already violates it is not.
CREATE UNIQUE INDEX business_profile_by_owner_uidx ON business_profile (owner_user_id);

-- Drafts and suspended businesses are not searchable, so they do not belong in
-- the index either.
CREATE INDEX business_profile_published_idx ON business_profile (state, city)
WHERE
    status = 'PUBLISHED';

-- NOT a history. This table holds the current configuration only; an UPDATE
-- overwrites the previous state with nothing left behind. What applied
-- yesterday lives solely in the snapshot columns on job_request. A real price
-- history would mean immutable price versions that a request references -- the
-- next step, not this one.
--
-- Note the two columns without a DEFAULT, against the grain of the rest of this
-- table: travel_fee_mode and material_pricing_mode. A default would let the row
-- be created before the tradesperson chose anything, and it would then assert
-- "travel included, material included" -- a statement about money that nobody
-- made. So this row is created in wizard step 5, not with the profile. Contrast
-- availability_booking_policy in V4, which IS created with the profile,
-- precisely because every one of its columns has a defensible default.
CREATE TABLE
    business_pricing (
        business_id UUID NOT NULL REFERENCES business_profile (id) ON DELETE CASCADE,
        currency CHAR(3) NOT NULL DEFAULT 'USD',
        hourly_rate NUMERIC(19, 4),
        minimum_billable_minutes INTEGER NOT NULL DEFAULT 60,
        billing_increment_minutes INTEGER NOT NULL DEFAULT 15,
        -- Very US: "$89 service call fee", often waived when the job goes ahead.
        service_call_fee NUMERIC(19, 4),
        service_call_fee_waived_if_hired BOOLEAN NOT NULL DEFAULT FALSE,
        travel_fee_mode VARCHAR(32) NOT NULL,
        travel_flat_fee NUMERIC(19, 4),
        travel_rate_per_mile NUMERIC(19, 4),
        free_travel_radius_miles INTEGER,
        -- Material is not an amount, it is a model. What is fixable up front is not
        -- what material costs but how it is billed; a material_cost column would be
        -- either always empty or always wrong.
        material_pricing_mode VARCHAR(32) NOT NULL,
        material_markup_percent NUMERIC(5, 2),
        cancellation_fee NUMERIC(19, 4) NOT NULL DEFAULT 0,
        -- Hours, not "one day": 24 answers "may I still cancel" with a subtraction.
        -- "The day before" has to be interpreted first -- calendar day or 24 hours?
        -- -- and the first person who wants 48 breaks the model.
        cancellation_notice_hours INTEGER NOT NULL DEFAULT 24,
        created_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            updated_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            version BIGINT NOT NULL,
            PRIMARY KEY (business_id),
            -- The mode governs BOTH fields, not just its own: otherwise switching from
            -- FLAT to PER_MILE leaves the old flat amount sitting there, and it
            -- resurfaces the next time someone switches back. The price for that is
            -- that a mode change must null the no-longer-valid field in the same
            -- UPDATE -- hiding the input is not enough.
            CHECK (
                (
                    travel_fee_mode = 'INCLUDED'
                    AND travel_flat_fee IS NULL
                    AND travel_rate_per_mile IS NULL
                )
                OR (
                    travel_fee_mode = 'FLAT'
                    AND travel_flat_fee IS NOT NULL
                    AND travel_rate_per_mile IS NULL
                )
                OR (
                    travel_fee_mode = 'PER_MILE'
                    AND travel_flat_fee IS NULL
                    AND travel_rate_per_mile IS NOT NULL
                )
            ),
            CHECK (
                material_pricing_mode IN (
                    'INCLUDED',
                    'AT_COST',
                    'COST_PLUS_MARKUP',
                    'NOT_PROVIDED'
                )
            ),
            -- Two-sided for the same reason as travel: yesterday's markup must not
            -- survive a switch to AT_COST and turn up again later.
            CHECK (
                (
                    material_pricing_mode = 'COST_PLUS_MARKUP'
                    AND material_markup_percent IS NOT NULL
                )
                OR (
                    material_pricing_mode <> 'COST_PLUS_MARKUP'
                    AND material_markup_percent IS NULL
                )
            ),
            -- Waiving a fee that does not exist is not a statement.
            CHECK (
                NOT service_call_fee_waived_if_hired
                OR service_call_fee IS NOT NULL
            ),
            CHECK (cancellation_notice_hours BETWEEN 0 AND 720),
            -- No amount is negative. Cheap, and it catches the mistyped hourly rate
            -- before it is snapshotted onto a request.
            CHECK (
                hourly_rate IS NULL
                OR hourly_rate >= 0
            ),
            CHECK (
                service_call_fee IS NULL
                OR service_call_fee >= 0
            ),
            CHECK (
                travel_flat_fee IS NULL
                OR travel_flat_fee >= 0
            ),
            CHECK (
                travel_rate_per_mile IS NULL
                OR travel_rate_per_mile >= 0
            ),
            CHECK (
                free_travel_radius_miles IS NULL
                OR free_travel_radius_miles >= 0
            ),
            CHECK (
                material_markup_percent IS NULL
                OR material_markup_percent >= 0
            ),
            CHECK (cancellation_fee >= 0),
            CHECK (minimum_billable_minutes > 0),
            CHECK (billing_increment_minutes > 0)
    );

-- Primary and secondary trades in ONE table with a flag, not a column on the
-- profile plus a table beside it: otherwise every "find me all plumbers" query
-- has to union two places and index both.
CREATE TABLE
    business_trade (
        business_id UUID NOT NULL REFERENCES business_profile (id) ON DELETE CASCADE,
        trade_id UUID NOT NULL REFERENCES trade (id),
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (business_id, trade_id)
    );

-- AT MOST one primary trade, enforced by the database instead of hoped for in
-- application code. No primary trade stays legal, which is correct for a DRAFT.
-- That EXACTLY one exists at the DRAFT -> PUBLISHED transition is something a
-- partial index cannot express; the publish service checks it in the same
-- transaction that sets status.
CREATE UNIQUE INDEX business_trade_primary_uidx ON business_trade (business_id)
WHERE
    is_primary;

CREATE INDEX business_trade_by_trade_idx ON business_trade (trade_id);

-- Duration mandatory, price optional but with a mode. The duration is the
-- reason a slot has a length. On the price: no plumber quotes a flat rate for
-- "leak fix" before seeing it, and a bare NUMERIC column forces a number that
-- cannot be honoured.
CREATE TABLE
    business_service (
        id UUID NOT NULL,
        business_id UUID NOT NULL,
        trade_id UUID,
        name VARCHAR(160) NOT NULL, -- "Clog removal"
        description VARCHAR(2000), -- bounded for the reason given on business_profile

        -- "estimated", because the reserved calendar duration is not the billed
        -- working time. The calendar plans with this; the invoice does not.
        estimated_duration_minutes INTEGER NOT NULL,
        pricing_mode VARCHAR(32) NOT NULL,
        price NUMERIC(19, 4),
        -- Not a DELETE: a service that past appointments point at must not vanish.
        -- Deactivating removes it from the picker without tearing up the history.
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            updated_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            version BIGINT NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY (business_id) REFERENCES business_profile (id) ON DELETE CASCADE,
            -- Composite, rather than a plain reference to trade(id): otherwise a
            -- business could file a service under a trade it does not itself hold.
            -- Going through business_trade checks both things in one constraint -- that
            -- the trade exists, and that this business offers it.
            --
            -- trade_id stays optional. Under MATCH SIMPLE (the default) a composite
            -- foreign key with a NULL part is not checked at all, so cross-trade
            -- services remain possible.
            --
            -- The column list after SET NULL needs PostgreSQL 15+. Without it, removing
            -- a trade would try to null business_id as well, and fail.
            FOREIGN KEY (business_id, trade_id) REFERENCES business_trade (business_id, trade_id) ON DELETE SET NULL (trade_id),
            CHECK (estimated_duration_minutes BETWEEN 15 AND 480),
            CHECK (
                pricing_mode IN ('FLAT', 'STARTING_AT', 'HOURLY', 'QUOTE_ONLY')
            ),
            -- FLAT and STARTING_AT need a number. QUOTE_ONLY says "not before I have
            -- seen it" and must therefore not carry one either.
            --
            -- HOURLY is the special case: price stays allowed and then overrides the
            -- general hourly rate, which is what an emergency call at a higher tariff
            -- needs.
            CHECK (
                (
                    pricing_mode IN ('FLAT', 'STARTING_AT')
                    AND price IS NOT NULL
                )
                OR (pricing_mode = 'HOURLY')
                OR (
                    pricing_mode = 'QUOTE_ONLY'
                    AND price IS NULL
                )
            ),
            CHECK (
                price IS NULL
                OR price >= 0
            ),
            -- Foreign key target for job_request, when the `job` module brings it.
            -- PostgreSQL requires a unique constraint over exactly the referenced column
            -- combination -- id being the primary key on its own is not enough.
            UNIQUE (business_id, id)
    );

-- Case-insensitive, because "Clog removal" and "clog removal" are the same
-- entry to everyone except a byte comparison.
CREATE UNIQUE INDEX business_service_by_name_uidx ON business_service (business_id, lower(name));

-- Its own table rather than two columns, because licensing is per state and a
-- tradesperson near a state line legally works in two. verified_at is the
-- "checked by TradeTies" mark -- a strong trust signal on the US market.
CREATE TABLE
    business_license (
        id UUID NOT NULL,
        business_id UUID NOT NULL REFERENCES business_profile (id) ON DELETE CASCADE,
        state CHAR(2) NOT NULL REFERENCES us_state (code),
        license_number VARCHAR(64) NOT NULL,
        license_type VARCHAR(120),
        issued_on DATE,
        expires_on DATE,
        -- Confirms only the combination of state, license_number and license_type
        -- in this exact row. If any of the three changes, the application must
        -- reset verified_at to NULL in the same UPDATE -- otherwise an unverified
        -- number wears the previous one's seal of approval.
        verified_at TIMESTAMP(6)
        WITH
            TIME ZONE,
            created_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            updated_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            version BIGINT NOT NULL,
            PRIMARY KEY (id),
            CHECK (
                issued_on IS NULL
                OR expires_on IS NULL
                OR expires_on >= issued_on
            )
    );

CREATE UNIQUE INDEX business_license_uidx ON business_license (business_id, state, license_number);