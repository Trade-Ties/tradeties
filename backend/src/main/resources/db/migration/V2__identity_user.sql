-- ---------------------------------------------------------------------------
-- Local projection of the WorkOS user, plus the marketplace roles it holds.
--
-- Two ids on purpose. workos_user_id is the external key we authenticate
-- against; id is ours, and it is the one every other module will reference.
-- Nothing outside this module ever foreign-keys to the provider's id, which is
-- what keeps the identity provider replaceable (DECISIONS section 7).
--
-- A row exists only for someone who has actually REGISTERED. Merely holding a
-- valid token creates nothing -- see GET /api/v1/me, which is read-only.
-- ---------------------------------------------------------------------------

CREATE TABLE identity_user
(
    id             UUID                        NOT NULL,
    workos_user_id VARCHAR(255)                NOT NULL,
    email          VARCHAR(320),
    created_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    version        BIGINT                      NOT NULL,

    PRIMARY KEY (id)
);

-- Registration is idempotent, and the portal re-posts it on every sign-in.
-- This constraint is what makes that safe: two concurrent first sign-ins race
-- to INSERT, and the database rejects the loser instead of silently creating a
-- second projection of the same person.
CREATE UNIQUE INDEX identity_user_by_workos_user_id_uidx
    ON identity_user (workos_user_id);

-- Roles are a set, not a column: DECISIONS section 2 allows a tradesperson to
-- also book work, so holding CUSTOMER and BUSINESS_OWNER at once is legitimate.
-- The primary key makes granting an already-held role a no-op at the schema
-- level rather than something application code has to remember to check.
CREATE TABLE identity_user_role
(
    user_id UUID        NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    role    VARCHAR(64) NOT NULL,

    PRIMARY KEY (user_id, role)
);
