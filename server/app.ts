import cors from "cors";
import express from "express";
import { z } from "zod";
import { statuses, type ApplicationInput } from "../shared/types.js";
import { MemoryApplicationStore, type ApplicationStore } from "./store.js";
import { hashPassword, MemoryUserStore, verifyPassword, type UserStore } from "./auth.js";

const applicationInput = z.object({ company: z.string().min(1), role: z.string().min(1), status: z.enum(statuses), dateApplied: z.string().date().nullable(), jobDescription: z.string().default(""), notes: z.string().default(""), url: z.string().url().or(z.literal("")) });
const userId = (request: express.Request) => request.header("x-user-id") || "demo-user";

export function createApp(store: ApplicationStore = new MemoryApplicationStore(), users: UserStore = new MemoryUserStore()) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/api/health", (_request, response) => {
    response.json({ message: "Applywise API is running" });
  });
  app.post("/api/auth/register", async (request, response) => { const parsed = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Use a valid email and a password of at least 8 characters." }); if (await users.findByEmail(parsed.data.email.toLowerCase())) return response.status(409).json({ error: "An account with that email already exists." }); const user = await users.create(parsed.data.email.toLowerCase(), await hashPassword(parsed.data.password)); return response.status(201).json({ userId: user.id, email: user.email }); });
  app.post("/api/auth/login", async (request, response) => { const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(request.body); if (!parsed.success) return response.status(400).json({ error: "Invalid credentials." }); const user = await users.findByEmail(parsed.data.email.toLowerCase()); if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return response.status(401).json({ error: "Invalid credentials." }); return response.json({ userId: user.id, email: user.email }); });
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
  return app;
}
