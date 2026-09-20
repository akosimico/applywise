import dotenv from "dotenv";
import { createApp } from "./app.js";
import { PostgresApplicationStore } from "./store.js";
import pg from "pg";
import { PostgresUserStore } from "./auth.js";
import { PostgresResumeStore } from "./resume-store.js";
import { scheduleFollowUpSweep } from "./follow-up.js";
import { PostgresDiscoveryStore } from "./discovery.js";

// Prefer this project's local configuration over any unrelated shell/system variable.
dotenv.config({ override: true });

const port = Number(process.env.PORT ?? 3001);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const applications = new PostgresApplicationStore(pool);
createApp(applications, new PostgresUserStore(pool), new PostgresResumeStore(pool), undefined, new PostgresDiscoveryStore(pool)).listen(port, () => console.log(`Applywise API listening on ${port}`));
scheduleFollowUpSweep(applications, pool);
