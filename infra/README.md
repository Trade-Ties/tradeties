# Infrastructure

Configuration only — no application code lives here.

```
infra/
├── .env.example        template for the Compose environment
├── .env                real values, never committed
├── compose.yaml        PostgreSQL  (backend, frontend and Traefik join it later)
└── postgres/
    ├── initdb/         runs once, when the data volume is created
    └── dev-seed.sql    one finished business, run by hand
```

## The database that stays

```bash
cd infra && docker compose up -d
cd backend && ./mvnw spring-boot:run
```

`spring-boot:run`, not `spring-boot:test-run` — the difference is the whole point.
`test-run` provisions a throwaway container through Testcontainers and drops it when
the JVM exits, so everything entered through the wizard is gone at the next start.
The Compose container keeps its data in a named volume that outlives
`docker compose down`.

The defaults in `compose.yaml` are exactly the ones in the backend's
`application.yml`, so this needs no environment of its own — with one caveat below.

Reset to an empty database:

```bash
docker compose down -v   # -v is the volume, and the volume is the data
docker compose up -d
```

### Port 5432 may not be yours

If PostgreSQL is already installed natively — a Windows service, Homebrew, another
project's container — it holds 5432, and this collision does not announce itself.
On Windows both it and Docker can bind `0.0.0.0:5432`; the container starts
cleanly and the backend authenticates against whichever server wins. The symptom
is `password authentication failed for user "tradeties"` against a server nobody
configured.

Check first:

```bash
netstat -ano | findstr :5432      # Windows
lsof -i :5432                     # macOS / Linux
```

If it is taken, move the container's host port in `infra/.env` and tell the backend
and the test suite where it went:

```bash
echo POSTGRES_PORT=55432 >> .env
docker compose up -d

export DATABASE_URL=jdbc:postgresql://localhost:55432/tradeties
./mvnw verify -Pcompose-db -Dcompose.db.url=jdbc:postgresql://localhost:55432/tradeties_test
```

`.env` is gitignored, which is right: the collision is a property of one machine,
not of the project.

## Two databases, one container

`initdb/10-test-database.sql` creates a second database beside `tradeties`:

| Database | Holds | Emptied |
| --- | --- | --- |
| `tradeties` | your development data | only by `docker compose down -v` |
| `tradeties_test` | the test suite | at the start of every `-Pcompose-db` run |

They are separate databases in one PostgreSQL: separate catalogues, separate
tables, no query crosses between them.

The split is not tidiness. Development data has to survive a restart, and the
suite needs a known empty starting point — `TestcontainersConfiguration` explains
why. One database cannot satisfy both.

Running the suite against `tradeties_test` is opt-in:

```bash
cd backend && ./mvnw verify -Pcompose-db
```

Plain `./mvnw verify` still uses a throwaway Testcontainers container, and must:
CI has no Compose stack, so that is the only PostgreSQL available there.

The initdb directory runs **only** on an empty data volume. A volume created
before this file existed has no `tradeties_test` in it — `docker compose down -v`
once, or create it by hand.

## Seed data

A fresh database has the reference data the migrations carry — trades, states,
time zones — and nothing else. `postgres/dev-seed.sql` adds one finished
business: primary trade, three services across three pricing modes, working
hours, pricing, booking policy, `PUBLISHED`.

```bash
docker compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U tradeties -d tradeties < postgres/dev-seed.sql
```

Run it after the backend has started once, so the tables exist. Running it twice
does nothing the second time.

It is a script rather than a Flyway migration on purpose. Flyway owns the schema
and `ddl-auto: validate` is what keeps the code honest against it; a migration
that exists only on developer machines is the drift that arrangement prevents.

By default the business belongs to a placeholder subject nobody can sign in as.
To own it in the portal, pass your own WorkOS subject — sign in once, then read it
out of `identity_user.workos_user_id`:

```bash
docker compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 -v dev_owner=user_01ABC... -U tradeties -d tradeties < postgres/dev-seed.sql
```

### Marketplace inventory

One business is enough to open the portal and not enough to search. `postgres/dev-seed-marketplace.sql`
adds 24 more — 5 plumbers, 3 electricians, 2 carpenters, 2 roofers and one business
for every remaining trade, spread over five Denver ZIP codes (80202, 80204, 80206,
80209, 80239) with service radii from 10 to 50 miles:

```bash
docker compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U tradeties -d tradeties < postgres/dev-seed-marketplace.sql
```

Same rules as above: run it after the backend has started once, and running it twice
does nothing the second time. These businesses belong to placeholder subjects nobody
can sign in as — they are inventory for the customer side, not businesses to
administer. Use `dev-seed.sql` with your own subject for that.

## Environment

Docker Compose reads `infra/.env` automatically. Every variable has a working
default in `compose.yaml`, so an empty `.env` is a valid `.env`:

```bash
cp .env.example .env
```

`.env` is ignored repo-wide, so real credentials never reach Git. Add every new
variable to `.env.example` in the same commit that starts reading it — the
template is the only record of what a deployment needs.

## PostgreSQL

Two requirements the schema carries. Both fail at migration time rather than at
review time.

**PostgreSQL 15 or newer.** `V3__business_profile.sql` declares a foreign key
with `ON DELETE SET NULL (trade_id)` — nulling one *named* column instead of
every column in the key. That column list is 15+ syntax; on 14 the migration
fails outright, and without it dropping a trade would try to null `business_id`
as well and take the service down with it. `compose.yaml` and
`TestcontainersConfiguration` are both pinned to `postgis/postgis:18-3.6-alpine`;
keep the deployed version at or above the tested one.

**Three extensions, none of them optional.**

| Extension | Created in | Because |
| --- | --- | --- |
| `btree_gist` | `V3` | `V4`'s exclusion constraint on working hours combines equality on `(business_id, day_of_week)` with range overlap in one constraint, which plain GiST cannot express |
| `postgis` | `V16` | a business stores where it travels as a `geography` polygon, and the search asks which of those shapes contains the customer's point |
| `pg_trgm` | `V17` | a trigram index on `display_name`, for a business name typed with a typo |

Creating an extension needs a role that is permitted to — the Compose superuser
is, but on a managed database that is usually a one-off grant by an
administrator, not something the application user has by default. Get it wrong
and the very first migration run fails.

PostGIS is the one to settle before choosing a host. `btree_gist` and `pg_trgm`
ship with PostgreSQL itself; PostGIS does not, and where a managed offering does
not carry it, no grant makes it appear. `DatabaseExtensionsTests` asserts all
three are available, so a database that cannot serve them fails the suite
instead of the first migration that needs one.

## Traefik

Traefik terminates TLS and sits in front of the backend, which is why
`server.forward-headers-strategy: framework` is set in `application.yml`. The
backend must never be exposed directly — it trusts the `X-Forwarded-*` headers
Traefik sets.
