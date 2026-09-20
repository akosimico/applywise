# Applywise — Build Plan

**Target timeline:** ~3–4 weeks, part-time (adjust freely — milestones matter more than exact dates)

---

## The Problem

Job hunting after graduation usually means applying to 30–100+ roles. In practice this creates three compounding problems:

1. **Tracking chaos** — applications get logged in a messy spreadsheet or not at all, so it's easy to lose track of who you applied to, when, and what stage you're at.
2. **Generic applications** — most people send the same resume everywhere because tailoring each one manually to a job description takes too long, which hurts response rates.
3. **Follow-up drop-off** — after the initial application, most people simply forget to follow up, even though timely follow-ups measurably improve response rates.

None of these problems are individually hard to solve — but nobody actually solves them together in one lightweight tool, because generic ATS-style trackers don't do resume analysis, and resume-scoring tools don't track applications over time.

## What the Project Does

A single web app that combines three things that are normally separate tools:

1. **A tracker** — one place to log every application, its status, and its history, replacing the spreadsheet.
2. **An AI analyst** — paste a job description in, and the app scores your resume against it, highlights missing keywords, and suggests specific bullet-level tweaks — so tailoring a resume takes 2 minutes instead of 30.
3. **An automated nudge system** — a background job that watches for applications that have gone quiet (e.g., "Applied" for 10+ days with no update) and flags them so follow-ups don't fall through the cracks.

## What It Solves (the "so what")

- Turns an ad-hoc spreadsheet habit into a structured system → less lost information
- Turns "which resume version did I send this company" guesswork into targeted, per-application tailoring → higher-quality applications with less manual effort
- Turns "I meant to follow up" into an actual reminder system → fewer missed follow-ups
- As a side effect: it's a live demonstration, to anyone reviewing your portfolio, that you can ship a real product end-to-end — not just CRUD, but CRUD + applied AI + automation, which is exactly the skill combination a lot of new grad roles (especially "AI engineer" / "full-stack + AI" hybrid roles) are screening for.

---

## User Flow (what someone actually does in the app)

1. **Sign up / log in**
2. **Upload resume once** — stored as the "base resume" (plain text or parsed from PDF)
3. **Add an application** — paste company, role, job description, and the URL
4. On the application's detail page, click **"Analyze"**
   - App sends resume + job description to the LLM
   - Gets back: a match score, a list of matched/missing keywords, and 3–5 specific bullet-tweak suggestions
   - User can copy the suggested tweaks into their own resume manually (v1 doesn't auto-edit the resume file — see Cut list)
5. User updates the application's **status** as things progress (Applied → Screening → Interview → Offer/Rejected)
6. In the background, a **scheduled job runs daily**, checks all "Applied"-status applications, and flags any that have been silent for N days
7. User sees a **"Needs follow-up"** section on the dashboard listing those flagged applications
8. User acts on it (sends a follow-up email) and updates the status, which clears the flag

## System Flow (what the app does under the hood)

```
[Frontend: Next.js]
   |
   |  1. CRUD requests (create/update/delete application)
   v
[Backend API]
   |
   |  2. Writes/reads application data
   v
[Postgres DB] <---- applications, resume, analysis results
   |
   |  3. On "Analyze" request:
   |     Backend pulls resume + job description
   |     -> sends structured prompt to LLM API
   |     -> LLM returns JSON (score, gaps, suggestions)
   |     -> Backend validates JSON shape, retries on malformed response
   |     -> Saves result to DB, returns to frontend
   v
[LLM Provider — swappable via analyzeResume() interface]
   (Claude / OpenAI / Gemini / Groq — same JSON contract in/out)

[Scheduled Job / Cron]
   |
   |  Runs daily, independent of user activity
   |  Queries DB for stale "Applied" applications
   |  Writes a "needs_followup" flag back to DB
   v
[Postgres DB] --> read by frontend on next dashboard load
```

Two things worth designing deliberately (and worth mentioning in interviews):
- **Reliability boundary**: the LLM call is the one part of the system that can fail unpredictably (bad JSON, timeout, rate limit) — so it needs validation + retry + a sane fallback, unlike the rest of the CRUD flow which is deterministic. This matters more, not less, once multiple providers are in play (Claude/OpenAI/Gemini/Groq don't all fail the same way).
- **Provider abstraction**: the LLM call sits behind a single `analyzeResume(resume, jobDescription)` function rather than being called directly wherever it's needed. Swapping providers — or picking Groq for a fast first-pass and a stronger model for a final pass — becomes a one-file change instead of a refactor. Worth naming as a deliberate architecture choice in interviews.
- **Decoupled automation**: the cron job doesn't talk to the LLM or the frontend directly — it only reads/writes the DB, so it can run independently and fail without taking the app down.

---

## Milestone 0 — Setup & Planning (Day 1–2)

- [ ] Define exact feature scope for v1 (don't let this grow — see "Cut list" below)
- [ ] Choose stack: Frontend (React/Next.js), Backend (Node or FastAPI), DB (Postgres)
- [ ] Set up repo, README skeleton, `.gitignore`, license
- [ ] Set up local dev environment (DB running, hello-world frontend + backend talking to each other)
- [ ] Create a simple architecture diagram (even hand-drawn/Excalidraw is fine) — you'll refine this later for the README
- [ ] Choose LLM provider(s) — Claude, OpenAI, Gemini (free tier via AI Studio), and/or Groq (fast, OpenAI-compatible API, hosts open models like Llama) are all viable
- [ ] Get API access sorted (API key(s), test a basic call works)

**Milestone check:** You can run the app locally and hit a "hello world" API route from the frontend.

---

## Milestone 1 — Core CRUD App (Week 1)

- [ ] Data model: `applications` table (company, role, status, date_applied, job_description, notes, url)
- [ ] Auth (simple email/password or magic link — don't overbuild this)
- [ ] API routes: create, read, update, delete application
- [ ] Frontend: list view of applications (table or cards)
- [ ] Frontend: add/edit application form
- [ ] Status field with a defined set of stages (Applied → Interview → Offer/Rejected)
- [ ] Basic styling pass — doesn't need to be fancy, needs to not look broken

**Milestone check:** You can add, edit, delete, and list applications through the UI. This alone is a working app — everything after this is what makes it stand out.

---

## Milestone 2 — AI Resume Scoring (Week 2)

- [ ] Design the prompt: input = resume text + job description, output = structured JSON (score, matched keywords, gaps)
- [ ] Implement structured output (Claude tool use / OpenAI function calling / Gemini `responseSchema` / Groq's OpenAI-compatible JSON mode) so you get reliable JSON back, not free text you have to regex
- [ ] Wrap the LLM call in a single `analyzeResume()` function so the provider is swappable behind one interface
- [ ] Add validation + retry logic for malformed LLM responses (this is the detail worth talking about in interviews)
- [ ] Backend route: `POST /applications/:id/analyze`
- [ ] Frontend: paste/upload resume once, store it; trigger analysis per application
- [ ] Display score + keyword gaps in the UI
- [ ] Add resume bullet suggestions (targeted tweaks, not full rewrite) as a second AI call or same call, extended

**Milestone check:** Given a job description already in the system, you can click "Analyze" and see a score + suggestions come back reliably.

---

## Milestone 3 — Automation Layer (Week 3)

- [ ] Decide the automation trigger: cron job vs. scheduled serverless function
- [ ] Logic: if `status = Applied` and no update in N days → flag for follow-up
- [ ] Implement the scheduled job (node-cron locally, or a scheduled function on your host)
- [ ] Surface flagged applications in the UI (e.g., a "Needs follow-up" section)
- [ ] (Stretch) Email/Slack notification instead of just in-app flag
- [ ] Log automation runs somewhere so you can demo "yes, this actually runs on a schedule"

**Milestone check:** You can demonstrate the automation working — either live or via logs — without you manually triggering it.

---

## Milestone 4 — Polish, Deploy, Document (Week 4)

- [ ] Deploy frontend (Vercel) and backend (Render/Railway) + hosted Postgres
- [ ] Environment variables and secrets handled properly (no keys in repo — mention this in README as a deliberate choice)
- [ ] Error states and loading states in the UI (empty list, failed AI call, etc.)
- [ ] Seed with a few realistic demo applications so a recruiter sees a populated app, not an empty shell
- [ ] Write the README:
  - [ ] Problem statement (why you built it)
  - [ ] Architecture diagram
  - [ ] Key technical decisions + tradeoffs (esp. LLM reliability handling)
  - [ ] Setup instructions
  - [ ] Live demo link + screenshots/GIF
- [ ] (Optional) Short write-up/blog post on one interesting decision — great linkable content for LinkedIn or your portfolio site

**Milestone check:** A stranger can open the README, understand what the project does and why, click the live link, and see it working.

---

## Cut list (things to explicitly NOT build for v1)

Keep this list visible so scope doesn't creep:
- Browser extension for auto-scraping job postings
- Multi-user teams/sharing
- Fine-tuning a model instead of prompting
- Full resume rewriter (bullet-level suggestions only)
- Mobile app version

---

## Interview-ready talking points (fill these in as you build)

- **Hardest bug you hit:**
- **A tradeoff you made and why:**
- **How you handled unreliable LLM output:**
- **What you'd do differently at scale:**