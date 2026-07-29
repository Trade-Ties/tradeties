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

```bash
pnpm install && pnpm dev               
cd backend && ./mvnw spring-boot:test-run 
cd infra && docker compose up -d        # not set up yet
```

`spring-boot:test-run` starts the app with a Testcontainers-managed PostgreSQL, so there is no separate database to install or keep in sync. To run against your own PostgreSQL instead, use `./mvnw spring-boot:run` and set `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`.

```bash
cd backend && ./mvnw verify
```
