# Applywise

Applywise is a focused job-application tracker that pairs application management with resume-to-job analysis and follow-up reminders.

## Stack

- React + Vite frontend
- Express + TypeScript API
- PostgreSQL (Docker Compose for local development)

## Local development

1. Copy `.env.example` to `.env`.
2. Run `docker compose up -d` to start PostgreSQL.
3. Load the schema with `docker compose exec -T postgres psql -U applywise -d applywise < db/schema.sql`.
4. Run `npm install` and `npm run dev`.
4. Open `http://localhost:5173`. The API health route is at `http://localhost:3001/api/health`.

## Quality checks

Run `npm test` and `npm run build` before merging changes.
