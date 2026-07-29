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

## Traefik

Traefik terminates TLS and sits in front of the backend, which is why
`server.forward-headers-strategy: framework` is set in `application.yml`. The
backend must never be exposed directly — it trusts the `X-Forwarded-*` headers
Traefik sets.
