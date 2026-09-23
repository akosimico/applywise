import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { mapApplication, MemoryApplicationStore } from "../server/store.js";
import { MemoryUserStore } from "../server/auth.js";
import { MemoryResumeStore } from "../server/resume-store.js";
import { LocalAnalyzer } from "../server/analysis.js";
import { runFollowUpSweep } from "../server/follow-up.js";
import {
  MemoryDiscoveryStore,
  profileFromResume,
} from "../server/discovery.js";

describe("health endpoint", () => {
  it("reports that the API is running", async () => {
    const response = await request(createApp()).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Applywise API is running");
  });
});

describe("follow-up automation", () => {
  it("flags old applied applications and leaves active stages alone", async () => {
    const store = new MemoryApplicationStore();
    const old = new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10);
    const applied = await store.create("demo-user", {
      company: "Old Co",
      role: "Dev",
      status: "Applied",
      dateApplied: old,
      jobDescription: "",
      notes: "",
      url: "",
    });
    await store.create("demo-user", {
      company: "Interview Co",
      role: "Dev",
      status: "Interview",
      dateApplied: old,
      jobDescription: "",
      notes: "",
      url: "",
    });
    expect(await runFollowUpSweep(store, 10)).toBe(1);
    expect((await store.find("demo-user", applied.id))?.needsFollowup).toBe(
      true,
    );
  });
});

describe("candidate profile extraction", () => {
  it("derives searchable skills without work-style preference", () => {
    const profile = profileFromResume(
      "Jane Doe\nBased in Manila\nFrontend Developer\nTypeScript React Node remote experience",
    );
    expect(profile.fullName).toBe("Jane Doe");
    expect(profile.skills).toEqual(
      expect.arrayContaining(["typescript", "react", "node"]),
    );
    expect(profile).not.toHaveProperty("workPreference");
  });
});

describe("resume analysis API", () => {
  it("stores a resume and returns validated analysis", async () => {
    const store = new MemoryApplicationStore();
    const app = createApp(
      store,
      new MemoryUserStore(),
      new MemoryResumeStore(),
      new LocalAnalyzer(),
    );
    const item = await store.create("demo-user", {
      company: "Acme",
      role: "Engineer",
      status: "Applied",
      dateApplied: null,
      jobDescription: "TypeScript React API development",
      notes: "",
      url: "",
    });
    await request(app)
      .put("/api/resume")
      .send({
        content:
          "Software engineer with TypeScript and React experience building products and APIs for users.",
      })
      .expect(204);
    const result = await request(app)
      .post(`/api/applications/${item.id}/analyze`)
      .expect(200);
    expect(result.body.score).toBeTypeOf("number");
    expect(result.body.suggestions.length).toBeGreaterThanOrEqual(3);
  });
});

describe("authentication API", () => {
  const app = createApp(new MemoryApplicationStore(), new MemoryUserStore());
  it("registers and logs in a user", async () => {
    const credentials = {
      email: "person@example.com",
      password: "safe-password",
    };
    const registered = await request(app)
      .post("/api/auth/register")
      .send(credentials)
      .expect(201);
    expect(registered.body.email).toBe(credentials.email);
    expect(
      (await request(app).post("/api/auth/login").send(credentials).expect(200))
        .body.userId,
    ).toBe(registered.body.userId);
  });
});

describe("applications API", () => {
  const app = createApp(new MemoryApplicationStore());
  const payload = {
    company: "Acme",
    role: "Software Engineer",
    status: "Applied",
    dateApplied: "2026-09-20",
    jobDescription: "TypeScript",
    notes: "Referral",
    url: "https://acme.test/jobs/1",
  };
  it("creates, lists, updates, and deletes an application", async () => {
    const created = await request(app)
      .post("/api/applications")
      .send(payload)
      .expect(201);
    expect(
      (await request(app).get("/api/applications").expect(200)).body,
    ).toHaveLength(1);
    expect(
      (
        await request(app)
          .put(`/api/applications/${created.body.id}`)
          .send({ ...payload, status: "Interview" })
          .expect(200)
      ).body.status,
    ).toBe("Interview");
    await request(app)
      .delete(`/api/applications/${created.body.id}`)
      .expect(204);
    expect((await request(app).get("/api/applications")).body).toHaveLength(0);
  });
});

describe("application date and status safety", () => {
  it("normalizes a PostgreSQL Date object to an ISO calendar date", () => {
    const mapped = mapApplication({
      id: "id",
      user_id: "demo-user",
      company: "Acme",
      role: "Engineer",
      status: "Applied",
      date_applied: new Date("2026-09-21T00:00:00.000Z"),
      job_description: "",
      notes: "",
      url: "",
      needs_followup: false,
      created_at: "2026-09-20T00:00:00.000Z",
      updated_at: "2026-09-20T00:00:00.000Z",
    });
    expect(mapped.dateApplied).toBe("2026-09-21");
  });

  it("updates only status and preserves the applied date", async () => {
    const store = new MemoryApplicationStore();
    const app = createApp(store);
    const item = await store.create("demo-user", {
      company: "Acme",
      role: "Engineer",
      status: "Applied",
      dateApplied: "2026-09-21",
      jobDescription: "",
      notes: "",
      url: "",
    });
    const response = await request(app)
      .put(`/api/applications/${item.id}`)
      .send({ status: "Interview" })
      .expect(200);
    expect(response.body.status).toBe("Interview");
    expect(response.body.dateApplied).toBe("2026-09-21");
  });

  it("assigns an applied date when a recommended role is added", async () => {
    const store = new MemoryApplicationStore();
    const discovery = new MemoryDiscoveryStore();
    await discovery.saveMatches("demo-user", [
      {
        id: "match-1",
        title: "Engineer",
        company: "Acme",
        location: "Manila",
        description: "React",
        url: "https://acme.test/job",
        score: 92,
        band: "Strong match",
        reasons: ["Matches React"],
        source: "Job board",
      },
    ]);
    const app = createApp(store, undefined, undefined, undefined, discovery);
    const response = await request(app)
      .post("/api/job-matches/match-1/add")
      .expect(201);
    expect(response.body.dateApplied).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses the tracker-add date when an existing recommendation is re-added", async () => {
    const store = new MemoryApplicationStore();
    const discovery = new MemoryDiscoveryStore();
    const existing = await store.create("demo-user", {
      company: "Acme",
      role: "Engineer",
      status: "Applied",
      dateApplied: null,
      jobDescription: "",
      notes: "",
      url: "",
    });
    await discovery.saveMatches("demo-user", [
      {
        id: "match-2",
        title: "Engineer",
        company: "Acme",
        location: "Manila",
        description: "React",
        url: "https://acme.test/job",
        score: 92,
        band: "Strong match",
        reasons: ["Matches React"],
        source: "Job board",
      },
    ]);
    const app = createApp(store, undefined, undefined, undefined, discovery);
    const response = await request(app)
      .post("/api/job-matches/match-2/add")
      .expect(200);
    expect(response.body.id).toBe(existing.id);
    expect(response.body.dateApplied).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await store.find("demo-user", existing.id))?.dateApplied).toBe(
      response.body.dateApplied,
    );
  });
});
