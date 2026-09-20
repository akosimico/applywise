import "dotenv/config";
import { createApp } from "./app.js";
import { PostgresApplicationStore } from "./store.js";
import pg from "pg";
import { PostgresUserStore } from "./auth.js";
import { PostgresResumeStore } from "./resume-store.js";

const port = Number(process.env.PORT ?? 3001);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
createApp(new PostgresApplicationStore(pool), new PostgresUserStore(pool), new PostgresResumeStore(pool)).listen(port, () => console.log(`Applywise API listening on ${port}`));
