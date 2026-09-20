import { randomUUID } from "node:crypto";
import pg from "pg";
import type { ApplicationStore } from "./store.js";
export async function runFollowUpSweep(store: ApplicationStore, days = Number(process.env.FOLLOW_UP_DAYS ?? 10), pool?: pg.Pool) { const flaggedCount = await store.flagStaleApplications(days); if (pool) await pool.query("INSERT INTO automation_runs (id, flagged_count) VALUES ($1,$2)", [randomUUID(), flaggedCount]); console.log(`[follow-up] ${new Date().toISOString()} flagged ${flaggedCount} application(s)`); return flaggedCount; }
export function scheduleFollowUpSweep(store: ApplicationStore, pool?: pg.Pool) {
  const safelyRun = () => void runFollowUpSweep(store, undefined, pool).catch(error => console.error("[follow-up] sweep failed", error));
  safelyRun();
  return setInterval(safelyRun, 24 * 60 * 60 * 1000);
}
