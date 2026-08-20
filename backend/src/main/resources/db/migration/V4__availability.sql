-- ---------------------------------------------------------------------------
-- Module `availability`: when a business works, when it does not, and the rules
-- that turn that into bookable slots.
--
-- Free slots are NOT a table. They are a calculation:
--
--     working hours (local, resolved through business_profile.time_zone)
--       - availability_time_off
--       - accepted job_requests (+/- appointment_buffer_minutes)
--       INTERSECT [now + min_lead_time_hours, now + booking_horizon_days]
--       aligned to slot_granularity_minutes, in the length of the chosen service
--       capped by max_accepted_appointments_per_day (business-local day)
--
-- DECISIONS section 1 asks for exactly that: "There is no separate blocking
-- step that could drift out of sync." A materialised slot table would be that
-- step.
-- ---------------------------------------------------------------------------

-- This row does double duty, and the second job is not visible in the DDL.
--
-- Besides holding the booking rules, it is the MUTEX for every write path that
-- touches the calendar. The exclusion constraint on job_request only protects
-- against two accepted appointments genuinely overlapping; it does not protect
-- against an appointment being accepted while, in parallel, time off is entered
-- over the same period, or the working hours of that weekday are shortened, or
-- the buffer to the neighbouring job is undercut. So all of those serialise on:
--
--     SELECT * FROM availability_booking_policy WHERE business_id = ? FOR UPDATE;
--
-- taken ALWAYS, even when max_accepted_appointments_per_day is NULL -- otherwise
-- correctness would hang on a configuration option.
--
-- Which is why THIS ROW MUST EXIST BEFORE ANY CALENDAR WRITE, and not only from
-- wizard step 8 onwards: step 7 already writes working hours, and
-- SELECT ... FOR UPDATE over zero rows locks nothing and reports no error.
--
-- The application provisions it on first use rather than creating it with the
-- profile. Both would satisfy the rule; this one keeps the module dependency
-- pointing one way, since `business` then never has to know that `availability`
-- exists. Every column below has a defensible default, so a row full of them
-- asserts nothing the tradesperson did not choose, and step 8 is an UPDATE.
--
-- Anyone adding a fifth calendar write path has to take the lock too. A rule
-- that holds for four of five paths is worse than no rule.
CREATE TABLE
    availability_booking_policy (
        business_id UUID NOT NULL REFERENCES business_profile (id) ON DELETE CASCADE,
        booking_horizon_days INTEGER NOT NULL DEFAULT 60,
        min_lead_time_hours INTEGER NOT NULL DEFAULT 24,
        -- "accepted" because the status ACCEPTED is precisely what gets counted; pending
        -- requests do not count, and per DECISIONS section 1 they do not hold a slot either.
        --
        -- Counted over the business-local calendar day from
        -- business_profile.time_zone, not over UTC: in America/Denver a UTC day
        -- moves the boundary seven hours into the afternoon.
        max_accepted_appointments_per_day INTEGER, -- NULL = unlimited
        slot_granularity_minutes INTEGER NOT NULL DEFAULT 30,
        appointment_buffer_minutes INTEGER NOT NULL DEFAULT 0, -- travel time
        created_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            updated_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            version BIGINT NOT NULL,
            PRIMARY KEY (business_id),
            CHECK (booking_horizon_days BETWEEN 1 AND 730),
            CHECK (min_lead_time_hours BETWEEN 0 AND 8760),
            CHECK (
                max_accepted_appointments_per_day IS NULL
                OR max_accepted_appointments_per_day > 0
            ),
            CHECK (slot_granularity_minutes IN (15, 30, 60)),
            CHECK (appointment_buffer_minutes >= 0)
    );

-- The most important decision in the model: TIME, not TIMESTAMPTZ.
--
-- DECISIONS section 6 says timestamps are TIMESTAMPTZ -- but working hours are
-- not points in time, they are recurring local rules. "Mondays from 8" still
-- means 8 after the daylight saving switch, not 7. Stored as UTC instants,
-- every business would slip by an hour twice a year, in six US time zones at
-- six different moments. The rule is local, business_profile.time_zone turns it
-- into an instant, and only the resulting SLOTS are TIMESTAMPTZ.
--
-- Consequence worth knowing: changing business_profile.time_zone silently moves
-- the whole calendar. The application has to say so before it saves.
--
-- "Monday 08:00-12:00 13:00-18:00" is TWO ROWS -- hence no morning_start /
-- afternoon_end columns. Three blocks, or a straight 07:00-19:00, fit the same
-- model unchanged.
CREATE TABLE
    availability_working_hours (
        id UUID NOT NULL,
        business_id UUID NOT NULL REFERENCES business_profile (id) ON DELETE CASCADE,
        -- SMALLINT per ISO-8601 (1 = Monday ... 7 = Sunday), not a string like
        -- identity_user_role: roles are an unordered set, weekdays have arithmetic
        -- and ordering -- and java.time.DayOfWeek.getValue() returns exactly these
        -- numbers.
        day_of_week SMALLINT NOT NULL,
        -- MINUTES since local midnight, 0..1440 -- local wall clock, NOT an instant.
        --
        -- Not TIME, and the reason is the upper bound. A working day can end at
        -- midnight, and midnight-at-the-end is 1440: a TIME column tops out at
        -- 23:59:59, java.time.LocalTime at 23:59:59.999999999, and neither can say
        -- "the end of this day" without overloading 00:00 to mean two different
        -- things depending on which column it sits in. As a count of minutes the
        -- boundary is an ordinary value, ends_at > starts_at stays total, and the
        -- slot calculation this table feeds is plain arithmetic -- in the same unit
        -- availability_booking_policy.slot_granularity_minutes already uses.
        --
        -- 480 does not read as 08:00 in a hand-written query:
        -- to_char(starts_at * interval '1 minute', 'HH24:MI') converts back.
        starts_at SMALLINT NOT NULL,
        ends_at SMALLINT NOT NULL,
        PRIMARY KEY (id),
        CHECK (day_of_week BETWEEN 1 AND 7),
        -- A start is a time of day, so it stops one minute short of the boundary;
        -- an end is the boundary itself and may be 1440.
        CHECK (starts_at BETWEEN 0 AND 1439),
        CHECK (ends_at BETWEEN 1 AND 1440),
        -- A block ends on the same day. A night shift 22:00-02:00 is still two rows
        -- on two weekdays -- but the seam between them is now closed rather than one
        -- minute wide: 1320..1440 on Monday and 0..120 on Tuesday meet exactly.
        CHECK (ends_at > starts_at)
    );

-- Overlapping blocks would make the slot calculation count time twice.
--
-- int4range is built in, which is the second dividend of storing minutes: a TIME
-- column would need a range type and a subtype_diff function declared by hand
-- before this constraint could be written at all. btree_gist, for the two
-- equality operands, comes from V3.
--
-- '[)' is already the default for the two-argument constructor, but it is
-- spelled out because everything hangs on it: it is what lets 08:00-12:00 and
-- 12:00-18:00 sit next to each other instead of counting as an overlap.
ALTER TABLE availability_working_hours
ADD CONSTRAINT availability_working_hours_no_overlap EXCLUDE USING gist (
    business_id
    WITH
        =,
        day_of_week
    WITH
        =,
        int4range (starts_at, ends_at, '[)')
    WITH
        &&
);

-- The counter-case to working hours: "away from July 4th to the 11th" is a real
-- interval, so TIMESTAMPTZ.
--
-- Note there is deliberately no exclusion constraint against appointments. Per
-- DECISIONS section 1, a NEW appointment may never fall into existing time off
-- -- the lock protocol above enforces that -- but NEW time off over an existing
-- appointment is a decision, not a violation: the business chooses per request
-- whether to decline it or keep it. A shared calendar table with one exclusion
-- rule over everything could not ask that question.
CREATE TABLE
    availability_time_off (
        id UUID NOT NULL,
        business_id UUID NOT NULL REFERENCES business_profile (id) ON DELETE CASCADE,
        starts_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            ends_at TIMESTAMP(6)
        WITH
            TIME ZONE NOT NULL,
            -- Never public. The customer must see WHEN a business is blocked, never
            -- WHY; the public view does not carry this column at all.
            reason VARCHAR(200),
            -- The PERSON, not the business. As soon as a business has more than one
            -- login, "the business confirmed" stops being information.
            created_by_user_id UUID NOT NULL REFERENCES identity_user (id),
            -- NULL as long as no accepted appointment fell in the period. Set in the
            -- same transaction in which the block is saved despite the warning.
            -- Blocking over a confirmed appointment is allowed, but only after warning
            -- and confirmation -- and "they were warned" only counts if it is written
            -- down somewhere.
            conflict_override_confirmed_at TIMESTAMP(6)
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
            CHECK (ends_at > starts_at)
    );

CREATE INDEX availability_time_off_by_business_idx ON availability_time_off (business_id, starts_at, ends_at);