# TradeTies

A two-sided marketplace connecting customers with local tradespeople: a customer-facing booking experience and a business-facing dashboard. Built for the US market.

This is a polyglot monorepo — frontend, backend, and infrastructure live in one Git repository.

## Project layout

```
tradeties/
├── api/        openapi.yaml — the shared API contract, source of truth for both sides
├── frontend/   Next.js app (TypeScript, Tailwind) — pnpm workspace member
├── backend/    Spring Boot (Java 25, Maven, modular monolith) — built by Maven
└── infra/      Docker Compose & Traefik — configuration only
```

`frontend` is the only pnpm workspace member. The Java backend is built by Maven and is not part of the pnpm workspace.

## Why a monorepo

Frontend and backend are tightly coupled, so keeping them together allows atomic cross-language commits, keeps them on one shared API contract, and gives the team a single checkout. A folder can be extracted into its own repository later if a part ever needs to be released or owned independently.

## What to watch out for

- **Separate build tools:** pnpm builds `frontend`, Maven builds `backend` — they don't know about each other. Only `frontend` is listed in `pnpm-workspace.yaml`.
- **Build-script approvals** (`sharp`, `unrs-resolver`) live under `allowBuilds` in the root `pnpm-workspace.yaml`.
- **Secrets stay out of Git:** `.env` files are ignored repo-wide — commit a `.env.example` template instead.
- **`api/openapi.yaml` is the one file both builds read.** It deliberately sits outside `backend/`; it belongs to neither side. This is the single path to sever if the backend is ever extracted.

## Getting started

Requirements: Node.js >= 20.9, pnpm 11 (via Corepack), JDK 25, and Docker.

Authentication runs against WorkOS AuthKit, so both sides need credentials from the
[WorkOS dashboard](https://dashboard.workos.com) before they will start:

```bash
cp frontend/.env.example frontend/.env.local   # then fill in — see the comments in it
export WORKOS_CLIENT_ID=client_...             # backend; must match the frontend's
```

Register `http://localhost:3000/callback` as a redirect URI in the WorkOS dashboard, or the
sign-in round trip fails with a redirect_uri mismatch.

```bash
pnpm install && pnpm dev               
cd backend && ./mvnw spring-boot:test-run 
cd infra && docker compose up -d        # not set up yet
```

`pnpm dev` regenerates the typed API client from `api/openapi.yaml` first, so it cannot go
stale. Docker Desktop must be running for the backend — its tests and `spring-boot:test-run`
provision PostgreSQL through Testcontainers.

Two entry points, and they behave differently by design:

| URL | Who | Account |
| --- | --- | --- |
| `http://localhost:3000/` | customers — search and book | none needed |
| `http://localhost:3000/portal` | tradespeople — sign in to the dashboard | required |

`spring-boot:test-run` starts the app with a Testcontainers-managed PostgreSQL, so there is no separate database to install or keep in sync. To run against your own PostgreSQL instead, use `./mvnw spring-boot:run` and set `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`.

```bash
cd backend && ./mvnw verify
```

## Contributing

| Document | Answers |
| --- | --- |
| [ONBOARDING.md](ONBOARDING.md) | **start here** — the step-by-step checklist from a fresh clone to a merged pull request |
| [CONTRIBUTING.md](CONTRIBUTING.md) | how to split a change, write the commit, and get it into `main` |
| [BRANCHING.md](BRANCHING.md) | how what is on `main` reaches customers — the two branches, the promotion, rollback |

Two branches matter. `main` is integration and feeds the test environment; `production` is
the latest commit approved for customers. Work happens on a feature branch, reaches `main`
through a pull request, and reaches customers only when someone presses **Promote to
production** under Actions. Merging is not shipping.
