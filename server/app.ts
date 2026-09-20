import cors from "cors";
import express from "express";
import { z } from "zod";
import { statuses, type ApplicationInput } from "../shared/types.js";
import { MemoryApplicationStore, type ApplicationStore } from "./store.js";
import { hashPassword, MemoryUserStore, verifyPassword, type UserStore } from "./auth.js";
import { analyzeWithRetry, type ResumeAnalyzer } from "./analysis.js";
import { MemoryResumeStore, type ResumeStore } from "./resume-store.js";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { MemoryDiscoveryStore, profileFromResume, searchJobs, type DiscoveryStore } from "./discovery.js";

const applicationInput = z.object({ company: z.string().min(1), role: z.string().min(1), status: z.enum(statuses), dateApplied: z.string().date().nullable(), jobDescription: z.string().default(""), notes: z.string().default(""), url: z.string().url().or(z.literal("")) });
const userId = (request: express.Request) => request.header("x-user-id") || "demo-user";

export function createApp(store: ApplicationStore = new MemoryApplicationStore(), users: UserStore = new MemoryUserStore(), resumes: ResumeStore = new MemoryResumeStore(), analyzer?: ResumeAnalyzer, discovery: DiscoveryStore = new MemoryDiscoveryStore()) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
  app.get("/api/health", (_request, response) => {
    response.json({ message: "Applywise API is running" });
  });
  app.post("/api/auth/register", async (request, response) => { const parsed = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Use a valid email and a password of at least 8 characters." }); if (await users.findByEmail(parsed.data.email.toLowerCase())) return response.status(409).json({ error: "An account with that email already exists." }); const user = await users.create(parsed.data.email.toLowerCase(), await hashPassword(parsed.data.password)); return response.status(201).json({ userId: user.id, email: user.email }); });
  app.post("/api/auth/login", async (request, response) => { const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Invalid credentials." }); const user = await users.findByEmail(parsed.data.email.toLowerCase()); if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return response.status(401).json({ error: "Invalid credentials." }); return response.json({ userId: user.id, email: user.email }); });
  app.put("/api/resume", async (request, response) => { const parsed = z.object({ content: z.string().min(50).max(50000) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Resume text must be 50–50,000 characters." }); await resumes.saveResume(userId(request), parsed.data.content); response.sendStatus(204); });
  app.get("/api/resume", async (request, response) => { const content = await resumes.getResume(userId(request)); return content ? response.json({ content }) : response.sendStatus(404); });
  app.post("/api/resume/pdf", upload.single("resume"), async (request, response) => { if (!request.file || request.file.mimetype !== "application/pdf") return response.status(400).json({ error: "Upload a PDF under 5 MB." }); const parser = new PDFParse({ data: request.file.buffer }); try { const text = (await parser.getText()).text.trim(); if (text.length < 50) return response.status(400).json({ error: "We could not read enough text from that PDF." }); const profile = profileFromResume(text); await resumes.saveResume(userId(request), text); await discovery.saveProfile(userId(request), profile); return response.json({ profile, extractedCharacters: text.length }); } finally { await parser.destroy(); } });
  const profileInput=z.object({fullName:z.string().max(120),location:z.string().max(120),targetRoles:z.array(z.string().max(100)).max(8),skills:z.array(z.string().max(60)).max(30),workPreference:z.enum(["remote","hybrid","onsite","any"])});
  app.get("/api/profile", async (request,response)=>{const profile=await discovery.getProfile(userId(request));return profile?response.json(profile):response.sendStatus(404)});
  app.put("/api/profile", async (request,response)=>{const parsed=profileInput.safeParse(request.body);if(!parsed.success)return response.status(400).json({error:"Invalid profile."});await discovery.saveProfile(userId(request),parsed.data);response.sendStatus(204)});
  app.get("/api/job-matches",async(request,response)=>response.json(await discovery.listMatches(userId(request))));
  app.post("/api/job-matches/search",async(request,response)=>{const profile=await discovery.getProfile(userId(request));if(!profile)return response.status(400).json({error:"Upload a resume and review your profile first."});try{return response.json(await discovery.saveMatches(userId(request),await searchJobs(profile)))}catch(error){return response.status(503).json({error:error instanceof Error?error.message:"Job search is unavailable."})}});
  app.post("/api/job-matches/:id/add",async(request,response)=>{const match=await discovery.getMatch(userId(request),request.params.id);if(!match)return response.sendStatus(404);return response.status(201).json(await store.create(userId(request),{company:match.company,role:match.title,status:"Applied",dateApplied:null,jobDescription:match.description,notes:`Discovered via ${match.source}. Match: ${match.score}%`,url:match.url}))});
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
    const message = error instanceof Error ? error.message : "Unknown server error";
    const status = error instanceof multer.MulterError ? 400 : 500;
    response.status(status).json({ error: `Request failed: ${message}` });
  });
  return app;
}
