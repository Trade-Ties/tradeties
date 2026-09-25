-- ---------------------------------------------------------------------------
-- Makes one signed-in account TradeTies staff, for local work.
--
-- PLATFORM_ADMIN is granted by no endpoint and must not be: a role a signed-in
-- caller could ask for is a role every signed-in caller has. Out of band is the
-- design, and on a developer machine out of band means this file.
--
-- THE ACCOUNT HAS TO EXIST FIRST, which is the part that surprises. A row in
-- identity_user is written when somebody signs in -- the AuthKit callback
-- registers them -- so "I have an account with WorkOS" is not the same as "this
-- database has heard of me". Sign in once, then run this.
--
-- Not a migration, and never to be made one. Migrations run everywhere; this
-- hands out the most powerful role there is and belongs only where somebody
-- typed it on purpose.
--
-- Usage, from the infra directory:
--
--   docker compose exec -T postgres psql -U tradeties -d tradeties \
--     -v email=you@example.com -f /dev/stdin < postgres/dev-grant-admin.sql
--
-- or, with the file already inside the container:
--
--   psql -U tradeties -d tradeties -v email=you@example.com -f dev-grant-admin.sql
-- ---------------------------------------------------------------------------
-- The address is carried in through a session setting rather than straight into
-- the block below, because psql does not substitute its variables inside dollar
-- quotes -- it hands the whole block to the server untouched, and `:'email'`
-- arrives as a syntax error.
SELECT set_config('tradeties.grant_email', lower(:'email'), FALSE) \gset

DO $$
DECLARE
    wanted TEXT := current_setting('tradeties.grant_email');
    target UUID;
BEGIN
    SELECT id INTO target FROM identity_user WHERE lower(email) = wanted;

    -- Refused rather than silently doing nothing, which is the whole reason this
    -- is a block and not one INSERT. A mistyped address would otherwise match no
    -- row, report success, and leave somebody staring at a 403 on a page they
    -- had just given themselves access to.
    IF target IS NULL THEN
        RAISE EXCEPTION 'No account here for %. Sign in to the app once, then run this again.', wanted;
    END IF;

    INSERT INTO identity_user_role (user_id, role)
    VALUES (target, 'PLATFORM_ADMIN')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '% is now TradeTies staff.', wanted;
END
$$;
