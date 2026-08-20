# Infrastructure

Configuration only — no application code lives here.

```
infra/
├── .env.example        template for the Compose environment
├── .env                real values, never committed
└── compose.yaml        PostgreSQL, backend, frontend, Traefik  (not set up yet)
```

## Environment

Docker Compose reads `infra/.env` automatically. Copy the template and fill it in:

```bash
cp .env.example .env
```

`.env` is ignored repo-wide, so real credentials never reach Git. Add every new
variable to `.env.example` in the same commit that starts reading it — the
template is the only record of what a deployment needs.

Local development does not need any of this: `./mvnw spring-boot:test-run`
starts the backend against a Testcontainers-managed PostgreSQL.

## PostgreSQL

Two requirements the schema carries. Both fail at migration time rather than at
review time, so they are written down before `compose.yaml` exists rather than
after it turns out to be wrong.

**PostgreSQL 15 or newer.** `V3__business_profile.sql` declares a foreign key
with `ON DELETE SET NULL (trade_id)` — nulling one *named* column instead of
every column in the key. That column list is 15+ syntax; on 14 the migration
fails outright, and without it dropping a trade would try to null `business_id`
as well and take the service down with it. Tests run on `postgres:18-alpine`,
pinned in `TestcontainersConfiguration`, so keep the deployed version at or
above the tested one.

**The `btree_gist` extension.** `CREATE EXTENSION IF NOT EXISTS btree_gist` is
the first statement of `V3`, because `V4`'s exclusion constraint on working
hours combines equality on `(business_id, day_of_week)` with range overlap in
one constraint, which plain GiST cannot express. Creating an extension needs a
role that is permitted to — on a managed database that is usually a one-off
grant by an administrator, not something the application user has by default.
Get it wrong and the very first migration run fails.

## Traefik

Traefik terminates TLS and sits in front of the backend, which is why
`server.forward-headers-strategy: framework` is set in `application.yml`. The
backend must never be exposed directly — it trusts the `X-Forwarded-*` headers
Traefik sets.
