# Applywise

Applywise is a job-search workspace for organizing applications, finding resume-aligned opportunities, and identifying timely follow-ups. It combines an application tracker with resume import, job matching, and resume-to-role analysis.

## Features

- Account registration and sign-in
- Application tracking across Applied, Screening, Interview, Offer, and Rejected stages
- Resume PDF import with profile extraction
- Job discovery and match scoring based on a candidate profile
- Resume-to-job-description analysis, with an optional OpenAI-powered provider
- Automated follow-up flags for stale applications
- Search, status, and date filters for the application tracker

## Architecture

| Layer | Technology |
| --- | --- |
| Web client | React 19, Vite, TypeScript |
| API | Express 5, TypeScript |
| Database | PostgreSQL 16 |
| Local database | Docker Compose |
| Validation | Zod |
| Testing | Vitest and Supertest |

The development server runs the client on `http://localhost:5173` and the API on `http://localhost:3001`. Vite proxies `/api` requests to the API during local development.

## Prerequisites

- Node.js 20 or later
- npm
- Docker Desktop and Docker Compose (for the local PostgreSQL database)

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Start PostgreSQL:

   ```powershell
   docker compose up -d
   ```

4. Initialize the database schema:

   ```powershell
   Get-Content -Raw db/schema.sql | docker compose exec -T postgres psql -U applywise -d applywise
   ```

5. Start the client and API:

   ```powershell
   npm run dev
   ```

Open `http://localhost:5173`. The health endpoint is available at `http://localhost:3001/api/health`.

PostgreSQL is mapped to `127.0.0.1:15432` locally to avoid conflicts with a locally installed database.

## Environment variables

Copy `.env.example` to `.env`; never commit `.env` or production credentials.

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Port used by the API. Defaults to `3001`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `OPENAI_API_KEY` | No | Enables OpenAI-backed resume analysis. Without it, Applywise uses a deterministic local analysis fallback. |
| `OPENAI_MODEL` | No | Model used for OpenAI-backed analysis. Defaults to `gpt-4o-mini`. |
| `SERPAPI_API_KEY` | No | Enables external job discovery. |
| `FOLLOW_UP_DAYS` | No | Days after an application is created before it is flagged for follow-up. Defaults to `10`. |

## Quality checks

Run these checks before releasing a change:

```powershell
npm test
npm run build
```

`npm run build` type-checks the project and creates the client production bundle in `dist/client`.

## Production release checklist

Before exposing Applywise to users, ensure that the following are complete:

- Use a managed, backed-up PostgreSQL database and run `db/schema.sql` against it.
- Store all environment variables in the runtime's secret manager; do not place secrets in client-side code or source control.
- Serve the client over HTTPS and route `/api` requests to the API over the same trusted origin, or configure CORS to an explicit client origin.
- Add health checks for `GET /api/health`, database monitoring, centralized logs, and alerting.
- Configure database backups and verify a restore procedure.
- Set resource limits for uploads and request bodies at the edge as well as in the application.
- Run the quality checks above from a clean dependency install as part of the release pipeline.

### Required security work before a public launch

This repository is not yet safe for an internet-facing multi-user deployment. The API currently accepts the `x-user-id` request header as the caller's identity. A user could alter that header and access another user's data. The registration and login endpoints also return an ID without creating a server-side session or issuing a signed access token.

Replace this prototype identity mechanism with verified authentication and server-side authorization before launch. At minimum, use signed, expiring sessions or tokens; derive the user identity from verified credentials on the server; and remove all trust in client-supplied user identifiers. Restrict CORS to approved origins and review rate limiting, password-reset flows, security headers, and audit logging as part of the same release.

## Project layout

```text
client/             React application
server/             Express API, data stores, analysis, and follow-up logic
shared/             Types and shared domain utilities
db/schema.sql       PostgreSQL schema
tests/              API and behavior tests
docker-compose.yml  Local PostgreSQL service
```

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite client and API in watch mode. |
| `npm run dev:client` | Run only the Vite client. |
| `npm run dev:server` | Run only the API in watch mode. |
| `npm test` | Run the automated test suite. |
| `npm run build` | Type-check and build the client bundle. |
| `npm run db:debug` | Run the database diagnostic script. |

## License

ISC. See [`package.json`](package.json) for the current project metadata.
