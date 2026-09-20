import cors from "cors";
import express from "express";
import { z } from "zod";
import { statuses, type ApplicationInput } from "../shared/types.js";
import { MemoryApplicationStore, type ApplicationStore } from "./store.js";
import { hashPassword, MemoryUserStore, verifyPassword, type UserStore } from "./auth.js";
import { analyzeWithRetry, type ResumeAnalyzer } from "./analysis.js";
import { MemoryResumeStore, type ResumeStore } from "./resume-store.js";

const applicationInput = z.object({ company: z.string().min(1), role: z.string().min(1), status: z.enum(statuses), dateApplied: z.string().date().nullable(), jobDescription: z.string().default(""), notes: z.string().default(""), url: z.string().url().or(z.literal("")) });
const userId = (request: express.Request) => request.header("x-user-id") || "demo-user";

export function createApp(store: ApplicationStore = new MemoryApplicationStore(), users: UserStore = new MemoryUserStore(), resumes: ResumeStore = new MemoryResumeStore(), analyzer?: ResumeAnalyzer) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/api/health", (_request, response) => {
    response.json({ message: "Applywise API is running" });
  });
  app.post("/api/auth/register", async (request, response) => { const parsed = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Use a valid email and a password of at least 8 characters." }); if (await users.findByEmail(parsed.data.email.toLowerCase())) return response.status(409).json({ error: "An account with that email already exists." }); const user = await users.create(parsed.data.email.toLowerCase(), await hashPassword(parsed.data.password)); return response.status(201).json({ userId: user.id, email: user.email }); });
  app.post("/api/auth/login", async (request, response) => { const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Invalid credentials." }); const user = await users.findByEmail(parsed.data.email.toLowerCase()); if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return response.status(401).json({ error: "Invalid credentials." }); return response.json({ userId: user.id, email: user.email }); });
  app.put("/api/resume", async (request, response) => { const parsed = z.object({ content: z.string().min(50).max(50000) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Resume text must be 50–50,000 characters." }); await resumes.saveResume(userId(request), parsed.data.content); response.sendStatus(204); });
  app.get("/api/resume", async (request, response) => { const content = await resumes.getResume(userId(request)); return content ? response.json({ content }) : response.sendStatus(404); });
  app.get("/api/applications", async (request, response) => response.json(await store.list(userId(request))));
  app.get("/api/applications/:id", async (request, response) => { const item = await store.find(userId(request), request.params.id); return item ? response.json(item) : response.sendStatus(404); });
  app.post("/api/applications", async (request, response) => {
    const parsed = applicationInput.safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Invalid application", details: parsed.error.flatten() });
    return response.status(201).json(await store.create(userId(request), parsed.data as ApplicationInput));
  });
  app.put("/api/applications/:id", async (request, response) => {
    const parsed = applicationInput.safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Invalid application", details: parsed.error.flatten() });
    const item = await store.update(userId(request), request.params.id, parsed.data as ApplicationInput); return item ? response.json(item) : response.sendStatus(404);
  });
  app.delete("/api/applications/:id", async (request, response) => (await store.remove(userId(request), request.params.id)) ? response.sendStatus(204) : response.sendStatus(404));
  app.post("/api/applications/:id/analyze", async (request, response) => { const application = await store.find(userId(request), request.params.id); const resume = await resumes.getResume(userId(request)); if (!application) return response.sendStatus(404); if (!resume) return response.status(400).json({ error: "Save your base resume before analyzing." }); try { const result = analyzer ? await analyzeWithRetry(resume, application.jobDescription, analyzer) : await analyzeWithRetry(resume, application.jobDescription); await resumes.saveAnalysis(application.id, result); return response.json(result); } catch { return response.status(502).json({ error: "Analysis service is unavailable. Please try again." }); } });
  app.get("/api/applications/:id/analysis", async (request, response) => { const application = await store.find(userId(request), request.params.id); if (!application) return response.sendStatus(404); const result = await resumes.getAnalysis(application.id); return result ? response.json(result) : response.sendStatus(404); });
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error("API request failed", error);
    response.status(500).json({ error: "The database is unavailable. Confirm Docker is running and that DATABASE_URL is correct." });
  });
  return app;
}
