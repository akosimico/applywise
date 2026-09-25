# Applywise

> A full-stack job-application workspace that helps job seekers organize applications, discover relevant roles, and tailor resumes to job descriptions from one focused dashboard.

## Overview

Job searches often become fragmented across spreadsheets, job boards, saved links, and resume versions. Applywise centralizes that workflow: users can track every application stage, upload a resume to build a search profile, review job matches, and analyze how a resume aligns with a role.

The application separates a React client from an Express API and persists user data in PostgreSQL. Optional external providers add live job discovery and AI-assisted resume analysis without preventing the core tracker from working locally.

## Key Features

- **Application tracker** — Create, search, filter, update, and remove applications across five hiring stages.
- **Account access** — Register and log in with email and password credentials.
- **Resume import** — Upload a PDF resume; Applywise extracts text and derives a candidate profile.
- **Job matching** — Search external listings using target roles, skills, and location, then add a match to the tracker.
- **Resume analysis** — Compare a saved resume with a job description to identify matched keywords, gaps, and suggested improvements.
- **Follow-up reminders** — A daily server process flags stale applied applications after a configurable number of days.
- **Responsive workspace** — Use status, date, and keyword filters to keep an active search organized.

## How It Works

1. A user creates an account or logs in.
2. The user adds an application manually or imports a resume PDF to create a search profile.
3. The React client calls the REST API for tracking, profile, discovery, and analysis actions.
4. The Express API validates input and stores applications, resumes, analyses, profiles, and matches in PostgreSQL.
5. Optional job-search and OpenAI providers enrich matching and resume-analysis workflows.
6. A scheduled server sweep marks older applications that need follow-up.

## Tech Stack

| Category | Technologies |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Lucide React |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL 16, node-postgres |
| Validation and uploads | Zod, Multer, pdf-parse |
| AI and job discovery | OpenAI-compatible Chat Completions API, SerpApi |
| Local development | Docker Compose, tsx, concurrently |
| Testing | Vitest, Supertest |

## Architecture

The client communicates with the API through `/api` routes. During local development, Vite proxies those calls to Express; the API owns validation, persistence, provider calls, and follow-up automation.

```text
React + Vite client
        |
        | HTTPS / REST
        v
Express API
  |       |       |
  |       |       +-- OpenAI-compatible analysis (optional)
  |       +---------- SerpApi job search (optional)
  v
PostgreSQL
```

## Project Structure

```text
applywise/
├── client/              React client and styles
├── server/              Express API, data stores, and automation
├── shared/              Shared types and domain utilities
├── db/schema.sql        PostgreSQL schema
├── tests/               API and behavior tests
├── docker-compose.yml   Local PostgreSQL service
└── .env.example         Environment-variable template
```

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm
- Docker Desktop with Docker Compose

### Install dependencies

```powershell
npm install
```

### Configure environment variables

```powershell
Copy-Item .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | API port; defaults to `3001`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `OPENAI_API_KEY` | No | Enables OpenAI-backed resume analysis. Without it, a local deterministic fallback is used. |
| `OPENAI_MODEL` | No | OpenAI model for resume analysis; defaults to `gpt-4o-mini`. |
| `SERPAPI_API_KEY` | No | Enables external job discovery. |
| `FOLLOW_UP_DAYS` | No | Number of days before an applied role is flagged for follow-up; defaults to `10`. |

Never commit `.env` or add secrets to client-side code.

### Set up the database

```powershell
docker compose up -d
Get-Content -Raw db/schema.sql | docker compose exec -T postgres psql -U applywise -d applywise
```

Local PostgreSQL is available at `127.0.0.1:15432`.

### Run locally

```powershell
npm run dev
```

- Client: `http://localhost:5173`
- API health check: `http://localhost:3001/api/health`

## API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account. |
| `POST` | `/api/auth/login` | Validate account credentials. |
| `GET`, `POST` | `/api/applications` | List or create applications. |
| `GET`, `PUT`, `DELETE` | `/api/applications/:id` | Read, update the status of, or remove an application. |
| `PUT`, `GET` | `/api/resume` | Save or retrieve resume text. |
| `POST` | `/api/resume/pdf` | Import a resume PDF and create a candidate profile. |
| `POST` | `/api/applications/:id/analyze` | Analyze resume alignment for an application. |
| `GET`, `PUT` | `/api/profile` | Retrieve or update the candidate profile. |
| `POST` | `/api/job-matches/search` | Search and save matching job listings. |
| `GET` | `/api/health` | Check API availability. |

## Database

PostgreSQL stores the application's core data. `users` own `applications`, `resumes`, and `candidate_profiles`; deleting a user cascades to their related records. Each application can have one saved resume analysis. `job_matches` are unique per user and source URL, and applications are indexed by user and most recent update for tracker queries.

## Security

- Passwords are salted and hashed with Node.js `scrypt`.
- Request bodies are validated with Zod before persistence.
- Resume uploads are restricted to PDF files up to 5 MB and processed in memory.
- SQL queries use parameterized values through `pg`.
- Secrets are configured through environment variables.

## Testing

Run the test suite and production build checks with:

```powershell
npm test
npm run build
```

The automated tests cover API health, authentication, application lifecycle operations, follow-up automation, profile extraction, and resume analysis behavior.

## Engineering Decisions

### Separate client and API

The Vite client and Express API are separate so the interface can remain focused on user experience while validation, database access, provider integrations, and automation stay on the server.

### PostgreSQL for related job-search data

Applications, resumes, analyses, profiles, and matches have clear ownership relationships. PostgreSQL provides relational constraints, cascading deletes, JSON storage for structured analysis results, and indexed tracker queries.

### Optional external providers

Job search and OpenAI analysis are enabled only when their respective API keys are configured. The local analysis fallback keeps the resume-analysis flow usable during local development without an external key.

## What I Learned

- Designing and validating REST API workflows with Express and Zod.
- Modeling user-owned resources and relationships in PostgreSQL.
- Handling in-memory PDF uploads and turning extracted text into application data.
- Combining optional external APIs with reliable local fallbacks.
- Testing API behavior and background follow-up logic with Vitest and Supertest.

## Known Limitations

- External job discovery requires `SERPAPI_API_KEY`.
- OpenAI-backed analysis requires `OPENAI_API_KEY`; otherwise the local fallback is used.
- The current client supplies the user identifier in an `x-user-id` header. Replace this prototype mechanism with verified server-side authentication before a public multi-user release.
- When the API runs on a sleeping free-tier service, the first request may be delayed while it starts.

## License

ISC. See [`package.json`](package.json) for the current project metadata.
