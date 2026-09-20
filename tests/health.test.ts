import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { MemoryApplicationStore } from "../server/store.js";
import { MemoryUserStore } from "../server/auth.js";
import { MemoryResumeStore } from "../server/resume-store.js";
import { LocalAnalyzer } from "../server/analysis.js";

describe("health endpoint", () => {
  it("reports that the API is running", async () => {
    const response = await request(createApp()).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Applywise API is running");
  });
});

describe("resume analysis API", () => {
  it("stores a resume and returns validated analysis", async () => { const store = new MemoryApplicationStore(); const app = createApp(store, new MemoryUserStore(), new MemoryResumeStore(), new LocalAnalyzer()); const item = await store.create("demo-user", { company:"Acme",role:"Engineer",status:"Applied",dateApplied:null,jobDescription:"TypeScript React API development",notes:"",url:"" }); await request(app).put("/api/resume").send({content:"Software engineer with TypeScript and React experience building products and APIs for users."}).expect(204); const result = await request(app).post(`/api/applications/${item.id}/analyze`).expect(200); expect(result.body.score).toBeTypeOf("number"); expect(result.body.suggestions.length).toBeGreaterThanOrEqual(3); });
});

describe("authentication API", () => {
  const app = createApp(new MemoryApplicationStore(), new MemoryUserStore());
  it("registers and logs in a user", async () => {
    const credentials = { email: "person@example.com", password: "safe-password" };
    const registered = await request(app).post("/api/auth/register").send(credentials).expect(201);
    expect(registered.body.email).toBe(credentials.email);
    expect((await request(app).post("/api/auth/login").send(credentials).expect(200)).body.userId).toBe(registered.body.userId);
  });
});

describe("applications API", () => {
  const app = createApp(new MemoryApplicationStore());
  const payload = { company: "Acme", role: "Software Engineer", status: "Applied", dateApplied: "2026-09-20", jobDescription: "TypeScript", notes: "Referral", url: "https://acme.test/jobs/1" };
  it("creates, lists, updates, and deletes an application", async () => {
    const created = await request(app).post("/api/applications").send(payload).expect(201);
    expect((await request(app).get("/api/applications").expect(200)).body).toHaveLength(1);
    expect((await request(app).put(`/api/applications/${created.body.id}`).send({ ...payload, status: "Interview" }).expect(200)).body.status).toBe("Interview");
    await request(app).delete(`/api/applications/${created.body.id}`).expect(204);
    expect((await request(app).get("/api/applications")).body).toHaveLength(0);
  });
});
