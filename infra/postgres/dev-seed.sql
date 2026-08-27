-- ---------------------------------------------------------------------------
-- One finished business, for a database that has just been created.
--
-- Run BY HAND, against a database the backend has already migrated -- see the
-- "Seed data" section of infra/README.md for the invocation and for how to pass
-- your own WorkOS subject so the portal shows you the seeded business.
--
-- Deliberately not a Flyway migration. Flyway owns the schema here and
-- ddl-auto: validate is what keeps the code honest against it; a migration that
-- exists only on developer machines is exactly the drift that arrangement is
-- built to prevent. A repeatable migration in a dev-only location is worse
-- still -- it is recorded in flyway_schema_history, and the next start without
-- that location fails validation with a missing migration.
--
-- Idempotent: running it twice does nothing the second time.
-- ---------------------------------------------------------------------------
\if :{?dev_owner}
\else
\set dev_owner 'dev_seed_owner'
\endif

-- psql does not interpolate its variables inside dollar-quoted text, so the
-- subject is handed to the block below through a session setting instead.
SELECT set_config('tradeties.dev_owner', :'dev_owner', false);

DO $$
DECLARE
    owner_subject      TEXT        := current_setting('tradeties.dev_owner');
    seeded_owner_id    UUID        := '4e6f4dcb-2a1e-4a3f-9d2c-6b0f5e9c1a01';
    seeded_business_id UUID        := '4e6f4dcb-2a1e-4a3f-9d2c-6b0f5e9c1a02';
    plumber_id         UUID;
    now_utc            TIMESTAMPTZ := now();
BEGIN
    -- The whole script guards on the slug rather than each statement guarding
    -- itself. availability_working_hours carries an exclusion constraint that
    -- ON CONFLICT cannot target, so a second run has to be stopped before the
    -- first INSERT, not caught after it.
    IF EXISTS (SELECT 1 FROM business_profile WHERE slug = 'acme-plumbing') THEN
        RAISE NOTICE 'acme-plumbing already exists -- nothing seeded.';
        RETURN;
    END IF;

    -- By code, never by the pasted UUID. R__trade_reference_data.sql says the
    -- code is the identity; an id copied out of it here would be a second copy
    -- that stops matching the day that file is regenerated.
    SELECT id INTO STRICT plumber_id FROM trade WHERE code = 'PLUMBER';

    INSERT INTO identity_user (id, workos_user_id, email, created_at, updated_at, version)
    VALUES (seeded_owner_id, owner_subject, 'dispatch@acme.example', now_utc, now_utc, 0)
    ON CONFLICT (workos_user_id) DO NOTHING;

    -- A subject that already signed in has a row of its own, and it is that row
    -- the portal will look the business up by -- not the one just skipped.
    SELECT id INTO STRICT seeded_owner_id FROM identity_user WHERE workos_user_id = owner_subject;

    INSERT INTO identity_user_role (user_id, role)
    VALUES (seeded_owner_id, 'BUSINESS_OWNER')
    ON CONFLICT DO NOTHING;

    -- PUBLISHED, so it is visible to the customer side without a further step.
    -- first_published_at is not decoration: the CHECK added in V6 rejects the
    -- row without it, and the slug freeze reads it.
    INSERT INTO business_profile (
        id, owner_user_id, slug, legal_name, display_name, description, website_url,
        phone, email, street1, city, state, postal_code, latitude, longitude,
        time_zone, service_radius_miles, status, onboarding_completed_step,
        first_published_at, created_at, updated_at, version)
    VALUES (
        seeded_business_id, seeded_owner_id, 'acme-plumbing', 'Acme Plumbing LLC', 'Acme Plumbing',
        'Drains, water heaters and emergency call-outs across the Denver metro area.',
        'https://acme-plumbing.example', '+13035550101', 'dispatch@acme.example',
        '123 Main St', 'Denver', 'CO', '80202', 39.739236, -104.990251,
        'America/Denver', 25, 'PUBLISHED', 9, now_utc, now_utc, now_utc, 0);

    INSERT INTO business_trade (business_id, trade_id, is_primary)
    VALUES (seeded_business_id, plumber_id, TRUE);

    -- Three pricing modes on purpose: the wizard, the public profile and the
    -- readiness checklist each render them differently, and one mode seeded
    -- exercises none of that.
    INSERT INTO business_service (
        id, business_id, trade_id, name, description, estimated_duration_minutes,
        pricing_mode, price, active, sort_order, created_at, updated_at, version)
    VALUES
        ('4e6f4dcb-2a1e-4a3f-9d2c-6b0f5e9c1a03', seeded_business_id, plumber_id,
         'Clog removal', 'Kitchen, bathroom and main line.', 60,
         'STARTING_AT', 149.00, TRUE, 10, now_utc, now_utc, 0),
        ('4e6f4dcb-2a1e-4a3f-9d2c-6b0f5e9c1a04', seeded_business_id, plumber_id,
         'Water heater replacement', 'Tank and tankless, permit included.', 240,
         'QUOTE_ONLY', NULL, TRUE, 20, now_utc, now_utc, 0),
        ('4e6f4dcb-2a1e-4a3f-9d2c-6b0f5e9c1a05', seeded_business_id, plumber_id,
         'Emergency call-out', 'Same day, outside business hours.', 120,
         'HOURLY', 210.00, TRUE, 30, now_utc, now_utc, 0);

    -- travel_fee_mode INCLUDED forbids both travel amounts, and
    -- COST_PLUS_MARKUP requires the percentage -- V3 checks each pair from both
    -- sides, so half-filled money is rejected rather than stored.
    INSERT INTO business_pricing (
        business_id, currency, hourly_rate, minimum_billable_minutes,
        billing_increment_minutes, service_call_fee, service_call_fee_waived_if_hired,
        travel_fee_mode, material_pricing_mode, material_markup_percent,
        cancellation_fee, cancellation_notice_hours, created_at, updated_at, version)
    VALUES (
        seeded_business_id, 'USD', 145.00, 60, 15, 89.00, TRUE,
        'INCLUDED', 'COST_PLUS_MARKUP', 15.00, 50.00, 24, now_utc, now_utc, 0);

    -- Minutes since local midnight, not TIME -- see V4. 480 = 08:00, 720 = 12:00,
    -- 780 = 13:00, 1020 = 17:00. Monday to Friday, with a lunch break, so the two
    -- blocks per day the model is built around are actually present.
    INSERT INTO availability_working_hours (id, business_id, day_of_week, starts_at, ends_at)
    SELECT gen_random_uuid(), seeded_business_id, day, block.starts_at, block.ends_at
    FROM generate_series(1, 5) AS day,
         (VALUES (480, 720), (780, 1020)) AS block (starts_at, ends_at);

    -- The row every calendar write takes FOR UPDATE. The application provisions
    -- it on first use, so seeding it is not required -- but without it the
    -- seeded business's first booking behaves differently from every later one.
    INSERT INTO availability_booking_policy (
        business_id, booking_horizon_days, min_lead_time_hours,
        max_accepted_appointments_per_day, slot_granularity_minutes,
        appointment_buffer_minutes, created_at, updated_at, version)
    VALUES (seeded_business_id, 60, 24, 4, 30, 30, now_utc, now_utc, 0)
    ON CONFLICT (business_id) DO NOTHING;

    RAISE NOTICE 'Seeded acme-plumbing, owned by %.', owner_subject;
END $$;
