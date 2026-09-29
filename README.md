# URL Shortener + Analytics Backend

JavaScript/CommonJS API built with Express, PostgreSQL, Prisma 7, Redis, and BullMQ. This repository contains the backend only. The existing routes and PostgreSQL schema are retained.

## Features

- JWT authentication, bcrypt password hashing, owner-only link management, and an ADMIN API.
- Generated or custom slugs, Redis caching, and HTTP 302 redirects.
- Password-protected links with five-minute redirect tokens, expiration, enable/disable toggle, and atomic Redis click limits.
- PNG QR codes served from `uploads/qr/`, with safe replacement and deletion.
- BullMQ click analytics: browser, OS, device, GeoIP, referring origin/path, and UTM campaigns.
- Lifetime stats, paginated click history, time-series/grouped analytics, and account overview.
- Helmet, origin-aware CORS, input validation, rate limiting, and production-safe errors.
- Winston console/file logging, liveness/readiness endpoints, and graceful shutdown.
- OpenAPI/Swagger documentation, Jest/Supertest tests, and optional Docker API deployment.

## Requirements

- Node.js 22.12+ within the Node 22 release line, or Node.js 24+; npm.
- PostgreSQL 16 and Redis 7 (the included Compose services provide both).
- Docker with Docker Compose v2 if running the supplied containers.

Prisma 7 uses `@prisma/client` with `@prisma/adapter-pg`. The CLI config is named `prisma7.config.ts`, so Prisma commands must include `--config prisma7.config.ts`; the npm scripts already do this. Application source remains CommonJS JavaScript.

## Local setup (PowerShell)

Run commands from this backend directory. Preserve your existing `.env` if one is already configured.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` using the placeholders in `.env.example`. Never commit it. Configure your own database credentials and a randomly generated JWT secret. Production requires a secret of at least 32 characters and rejects common placeholder values. Percent-encode special characters in the username/password portions of database URLs.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `production`, or `test`; default `development` |
| `PORT` | Listening port, 1–65535; default `3000` |
| `DATABASE_URL` | PostgreSQL connection URL used by the normal application and CLI |
| `TEST_DATABASE_URL` | Separate PostgreSQL test database; required for real integration tests |
| `TEST_REDIS_URL` | Optional dedicated Redis test connection, e.g. `redis://localhost:6379/15` |
| `REDIS_URL` | Redis connection URL, e.g. `redis://localhost:6379` for local Compose |
| `JWT_SECRET` | Required signing secret; no production fallback |
| `JWT_EXPIRES_IN` | Positive duration such as `7d` |
| `BASE_URL` | Public HTTP(S) origin used in short and QR URLs, e.g. `http://localhost:3000`; no path/query |
| `CLIENT_URL` | Optional comma-separated browser origins permitted by CORS |
| `TRUST_PROXY` | `false` by default; configure only trusted proxy addresses/subnets or Express proxy names |
| `POSTGRES_USER` | Compose PostgreSQL username; default `admin` |
| `POSTGRES_PASSWORD` | Compose PostgreSQL password; required and must match your existing database |
| `POSTGRES_DB` | Compose PostgreSQL database; default `url_shortener` |
| `DATABASE_URL_DOCKER` | Optional API container's PostgreSQL URL; use hostname `postgres`, port `5432` |

`POSTGRES_*` settings initialize a **new** PostgreSQL data directory. Changing them does not change users or passwords in an existing volume. Match the working credentials already in your local environment; do not replace or reset the volume to resolve an authentication error.

Start only the dependencies for the normal Windows development workflow:

```powershell
docker compose up -d postgres redis
npm run prisma:generate
npx prisma migrate status --config prisma7.config.ts
```

On a new database, or when intentionally applying reviewed pending migrations:

```powershell
npm run prisma:deploy
```

This applies the existing migration history without creating a new migration. For an actual schema change during development, use `npm run prisma:migrate -- --name descriptive_change`, review the generated SQL, then run `npm run prisma:generate`. If Prisma reports unexpected drift or proposes a reset, stop and investigate instead of accepting the reset. This hardening work does not require a new schema migration.

```powershell
npm run dev
```

The API and analytics worker run in the same process. There is no second worker command. Use `npm start` without nodemon for a normal server process; set `NODE_ENV=production` in its deployment environment for production behavior.

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/ready
```

`/health` reports HTTP liveness. `/ready` checks PostgreSQL and Redis and returns `200` when both respond, or `503` when unavailable or shutting down. Dependency checks are bounded. Neither endpoint returns connection strings.

## API documentation and usage

- Swagger UI: <http://localhost:3000/api-docs>
- OpenAPI JSON: <http://localhost:3000/api-docs.json>
- OpenAPI source: `src/docs/openapi.js`

Use **Authorize** in Swagger with the account JWT returned by registration/login. The token is not retained across page reloads. Swagger's interactive requests call the real running backend and can create, edit, or delete its records.

| Method and path | Access / behavior |
| --- | --- |
| `POST /api/auth/register` | Public registration; returns safe user fields and an account JWT |
| `POST /api/auth/login` | Public login; returns safe user fields and an account JWT |
| `GET /api/auth/me` | Account JWT; current profile |
| `POST /api/auth/logout` | Account JWT; logout acknowledgement |
| `POST /api/links` | Create an owned link |
| `GET /api/links?page=1&limit=10` | List current user's links |
| `GET /api/links/:id` | Read an owned link |
| `PATCH /api/links/:id` | Update an owned link |
| `DELETE /api/links/:id` | Delete an owned link, clicks, cache, and generated QR |
| `POST /api/links/:id/toggle` | Toggle owned link ACTIVE/DISABLED |
| `POST /api/links/:id/qr` | Generate a QR PNG for an owned link |
| `GET /api/links/:id/stats` | Lifetime counts for an owned link |
| `GET /api/links/:id/clicks?page=1&limit=20` | Stored click history |
| `GET /api/links/:id/analytics?days=30` | Grouped/time-series analytics |
| `GET /api/analytics/overview?days=30` | Current user's aggregate analytics |
| `GET /api/admin/links?page=1&limit=20` | ADMIN role; all users' links with safe owner fields |
| `GET /:slug` | Public redirect, HTTP 302 with `Location` header |
| `POST /:slug/verify` | Verify protected link password; returns temporary redirect token |
| `GET /uploads/qr/:filename` | Public generated PNG |

All private routes require `Authorization: Bearer <account-token>`. Even ADMIN accounts use owner-only access on normal link/analytics routes; cross-user listing is provided by the explicit admin route. Missing or foreign owned links return `404`. A valid USER token receives `403` on the admin endpoint.

Create-link payload example (all fields except `originalUrl` are optional):

```json
{
  "originalUrl": "https://example.com/article",
  "title": "Example article",
  "slug": "example-link",
  "expiresAt": null,
  "maxClicks": null,
  "tags": ["articles"],
  "password": null
}
```

Omit `slug` for a random one. Custom slugs are case-sensitive, contain 3–50 letters/digits/underscores/hyphens, and cannot use reserved app paths. Destinations require HTTP(S) and cannot contain credentials. Passwords are limited to 72 UTF-8 bytes; account passwords require at least six characters and link passwords at least four. Expiry must be in the future. `maxClicks` is a positive 32-bit integer. PATCH uses `null` to clear optional restrictions. Password hashes never appear in API responses.

For a protected link, send `{"password":"your-link-password"}` to `POST /:slug/verify`, then follow `GET /:slug?token=<redirect-token>`. The redirect token expires in five minutes and cannot authenticate account endpoints. Disabled/expired/exhausted links return `410`; invalid or absent password tokens return `401`.

Pagination uses `data.pagination` with `page`, `limit`, `total`, and `totalPages`; `page` is 1–1000000, `limit` is 1–100. Analytics `days` is 1–365. Successful responses use `{ "success": true, "data": ... }`, sometimes with a `message`; delete/logout use a message. Errors use `{ "success": false, "error": "..." }`. Validation errors also include sanitized field details without submitted values. Duplicate emails/slugs return `409`, invalid inputs `400`, oversized bodies `413`, and rate limits `429`.

QR options are `size` (128–2048, default 512), `darkColor`, and `lightColor` (`#RRGGBB`). The directory is created automatically. New QR generation replaces the old owned generated file; deleting a link removes its file. Changing a slug clears/deletes its old QR, so generate a new one. Concurrent QR/link changes can return `409`; retry with the current link. Cleanup is restricted to generated filenames in `uploads/qr/`.

## Testing and database safety

```powershell
npm test
npm run test:coverage
npm run test:watch
```

The Jest/Supertest endpoint suites use deterministic database, Redis, and BullMQ test doubles while exercising routes, middleware, services, bcrypt/JWT, and QR generation. `npm test` also discovers the optional real PostgreSQL and Redis suites: each runs only when its explicit test connection is configured, otherwise it is reported as skipped. With neither test URL configured, no external services are required. To run only the deterministic suites even when test URLs are configured, use `npx jest --runInBand --testPathIgnorePatterns=integration.test.js`. Tests never substitute the development database for a missing test database. Mocked tests are not a substitute for verifying a deployed PostgreSQL/Redis environment.

Real PostgreSQL integration tests are opt-in:

1. Create a separate database using your database administrator. With the default Compose username, `docker compose exec postgres createdb -U admin url_shortener_test` creates it without changing the existing database. Run this only if it does not already exist; adapt the username if you changed it.
2. Set `TEST_DATABASE_URL` in `.env` to that database using your local credentials, for example `postgresql://USER:URL_ENCODED_PASSWORD@localhost:5432/url_shortener_test?schema=public`.
3. Apply the existing migrations **to the test database** and run the dedicated suite:

```powershell
$previousNodeEnv = $env:NODE_ENV
try {
  $env:NODE_ENV = "test"
  npm run prisma:deploy
} finally {
  $env:NODE_ENV = $previousNodeEnv
}
npm run test:integration
```

When `NODE_ENV=test`, both application configuration and Prisma CLI configuration use `TEST_DATABASE_URL`, never `DATABASE_URL`. The test database name must contain a delimited `test` component (for example `url_shortener_test`) and must differ from the normal database name. PostgreSQL tests create their own fixtures and remove only those fixture users and their related records; they do not reset/truncate shared tables. Most PostgreSQL checks mock Redis/BullMQ; when both test URLs are configured, an additional check runs a real BullMQ worker and verifies the stored PostgreSQL click. A missing `TEST_DATABASE_URL` skips the PostgreSQL suite with an explicit explanation; it does not silently test the development database.

For real Redis Lua/concurrency checks, set `TEST_REDIS_URL` in `.env` to a dedicated test connection such as `redis://localhost:6379/15`. This suite sends concurrent reservations to Redis, creates only random UUID fixture keys, and deletes exactly those keys afterward. It never calls `FLUSHDB` or `FLUSHALL`; its PostgreSQL dependency is mocked. Leave `TEST_REDIS_URL` unset to skip these checks.

`npm run test:integration` selects both optional integration files. It runs each configured service suite and explicitly skips any whose test URL is absent. `npm test` includes the same configured integration checks alongside the deterministic endpoint suites. The real BullMQ check creates a uniquely named `codex-test-<UUID>` queue and deletes only that queue afterward; it never targets the application's `analytics` queue. It exercises queue delivery and database processing in-process, rather than a separate deployed worker container.

Never run `docker compose down -v`, `prisma migrate reset`, or destructive database commands on the existing development data. The seed helper is not part of the test setup and is not run automatically.

## Docker API (optional)

The default Compose workflow continues to run only PostgreSQL and Redis. Existing service/container names and `postgres_data` / `redis_data` volumes are preserved. Published ports bind to loopback; use a deliberate reverse-proxy/network configuration when exposing a deployment.

For a containerized API, set `DATABASE_URL_DOCKER` in `.env` using the same database credentials but hostname **`postgres`**, not `localhost`. The API container connects to `redis://redis:6379`. Set the externally reachable `BASE_URL`, a strong production `JWT_SECRET`, and permitted `CLIENT_URL` origins. Apply reviewed migrations using the host CLI before starting the API.

```powershell
docker compose --profile api up -d --build
docker compose ps
docker compose logs --tail 100 api
```

Stop a locally running `npm run dev` first if it uses the same host port. The Dockerfile installs locked dependencies, generates the Prisma 7 CommonJS client inside Linux, prunes development dependencies, and runs as the non-root `node` user on Node 22 Debian slim. Peer dependencies can retain Prisma tooling after pruning. No real connection string is used during the image build. `.dockerignore` excludes local dependencies, environments, logs, uploads, tests, and tooling metadata. Migrations remain an explicit host/CI deployment step rather than a server startup action.

The `api_uploads` and `api_logs` named volumes persist container-generated files. They are separate from host `uploads/` and `logs/`; when moving an existing installation into the API container, copy existing QR files into the uploads volume and ensure ownership permits UID 1000 to read/write/delete them. Back up uploads with the database. Merely changing runtime mode does not migrate those host files.

Compose health checks gate API startup on PostgreSQL/Redis readiness. The image checks `/ready`. Docker init forwards signals; the server drains HTTP requests, closes worker/queue connections, and closes PostgreSQL/Redis on SIGINT/SIGTERM, with a bounded shutdown deadline.

## Operations and limitations

- CORS permits configured origins and `BASE_URL`. Development additionally permits localhost origins. Production does not send permissive CORS headers for arbitrary browser origins. Non-browser clients are still supported; CORS is not authentication.
- Rate limits are API 300/15 minutes, authentication 20/15 minutes, redirects 200/minute, and password verification 20/15 minutes per IP. Each limiter is mounted once; auth also counts against the general API limit. Counters are in process memory and reset on restart. Use a shared gateway/store before horizontally scaling if a cluster-wide limit is required. Test mode bypasses limiting for deterministic endpoint suites.
- Behind a reverse proxy, configure `TRUST_PROXY` only for its trusted address/subnet. Do not trust arbitrary forwarded headers. Terminate HTTPS at the deployment edge and use an HTTPS `BASE_URL` in production.
- Logout acknowledges client logout; stateless account JWTs remain valid until expiry. Clients must discard their token. Server-side token revocation is not implemented.
- Redirects reserve click capacity atomically in Redis, enqueue a job, and return without waiting for analytics database processing. Queue submission failure fails the request and retains its reservation: a timeout may occur after the queue already accepted the job, so releasing it could bypass `maxClicks`. A queue outage can therefore consume click capacity without a successful redirect. Repeated delivery of a job does not double-count its database click. Analytics is eventually consistent; IP-based unique visitors are approximate, and localhost/private IP GeoIP results are naturally `Unknown`.
- Only scalar `utm_source`, `utm_medium`, and `utm_campaign` values are retained (up to 500 characters). Redirect tokens and other query parameters are discarded. Referrer credentials/query/fragment are removed. Analytics still stores IP addresses and user agents; set your own retention/access policy for this data.
- Overview `totalClicks` covers the requested period; top links are ranked by lifetime stored clicks. Empty time buckets are omitted, and browser/OS/device/country aggregates return the largest ten groups.
- Redis stores cache entries, click reservations, and BullMQ jobs. Compose preserves Redis's existing RDB snapshot behavior and data volume and sets `noeviction`; RDB snapshots can lose recent writes after an abrupt failure. For production, arrange tested backups and durable Redis persistence/HA. Enabling AOF on an existing RDB-only installation requires a deliberate migration; this Compose update does not switch persistence modes automatically.
- PostgreSQL mutations and Redis invalidations are separate operations. They do not provide a distributed transaction; monitor Redis failures and reconcile affected cached entries/counters after an outage. Queue retries use exponential backoff; the latest 1000 completed and 5000 failed jobs are retained. Monitor failed jobs and dependency health.
- Winston writes `logs/error.log` and `logs/combined.log`, readable development console logs, and structured production logs. HTTP logging omits request query/body/authorization values. Errors redact credentials and omit production stack traces. Apply host/collector retention and disk monitoring for log files.
- Dependency readiness does not prove every background job has succeeded. Observe worker failure logs and exercise an end-to-end redirect/analytics smoke test in your deployment environment.
- Scoped dependency overrides retain Prisma 7 while updating `@prisma/config`'s `deepmerge-ts` to `8.0.2` and Prisma's `mysql2` to `3.24.4`. These match the upstream fixes for [configuration merging](https://github.com/prisma/orm/pull/30189) and [MySQL client vulnerabilities](https://github.com/prisma/orm/pull/30314). Review/remove the overrides when a supported Prisma release includes them; avoid `npm audit fix --force` suggestions that downgrade the existing ORM architecture.
- A dependency advisory remains in `geoip-lite@1.4.10` through its pinned `ip-address@5.9.4`: [HTML-emitting method XSS](https://github.com/advisories/GHSA-v2v4-37r5-5v8g) and [leading-zero address parsing](https://github.com/advisories/GHSA-mwp4-54f8-5fhr). Source inspection found this dependency used by geoip-lite's offline database updater, not the application's `geoip.lookup` request path; this backend neither renders those HTML methods nor uses that parser for network authorization. This reduces observed exposure but does not remove the vulnerable installed dependency. Do not force an `ip-address` 5-to-10 override: the updater calls the removed `bigInteger()` API. The [upstream geoip-lite 2.x manifest](https://github.com/geoip-lite/node-geoip/blob/main/package.json) uses a modern parser and requires Node 24, so a separate runtime/dependency upgrade and updater verification are needed to remove the residual safely.

The network dependency audit on 2026-09-29 reported two remaining affected packages (`geoip-lite` and `ip-address`): one moderate and one high finding. Re-run `npm audit` with network access during dependency maintenance; an offline/cache-only audit is not evidence that published advisories have been checked.

Useful commands: `npm run prisma:studio` opens Prisma Studio; `npm run prisma:generate` regenerates the client; `npm run prisma:deploy` applies reviewed existing migrations. No automatic seeding, database resets, or volume deletion occurs during server startup.
