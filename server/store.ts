import { randomUUID } from "node:crypto";
import pg from "pg";
import type { Application, ApplicationInput, ApplicationStatus } from "../shared/types.js";

export interface ApplicationStore {
  list(userId: string): Promise<Application[]>;
  find(userId: string, id: string): Promise<Application | undefined>;
  create(userId: string, input: ApplicationInput): Promise<Application>;
  update(userId: string, id: string, input: ApplicationInput): Promise<Application | undefined>;
  updateStatus(userId: string, id: string, status: ApplicationStatus): Promise<Application | undefined>;
  remove(userId: string, id: string): Promise<boolean>;
  flagStaleApplications(days: number): Promise<number>;
}

const dateOnly = (value: unknown, fallback: unknown): string | null => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const parsed = value ? new Date(String(value)) : new Date(String(fallback));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

export const mapApplication = (row: Record<string, unknown>): Application => ({
  id: String(row.id), userId: String(row.user_id), company: String(row.company), role: String(row.role),
  status: row.status as Application["status"], dateApplied: dateOnly(row.date_applied, row.created_at),
  jobDescription: String(row.job_description), notes: String(row.notes), url: String(row.url),
  needsFollowup: Boolean(row.needs_followup), createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString()
});

export class PostgresApplicationStore implements ApplicationStore {
  constructor(private readonly pool: pg.Pool) {}
  async list(userId: string) { const result = await this.pool.query("SELECT * FROM applications WHERE user_id = $1 ORDER BY updated_at DESC", [userId]); return result.rows.map(mapApplication); }
  async find(userId: string, id: string) { const result = await this.pool.query("SELECT * FROM applications WHERE id = $1 AND user_id = $2", [id, userId]); return result.rows[0] && mapApplication(result.rows[0]); }
  async create(userId: string, input: ApplicationInput) {
    const result = await this.pool.query(`INSERT INTO applications (id, user_id, company, role, status, date_applied, job_description, notes, url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [randomUUID(), userId, input.company, input.role, input.status, input.dateApplied, input.jobDescription, input.notes, input.url]);
    return mapApplication(result.rows[0]);
  }
  async update(userId: string, id: string, input: ApplicationInput) {
    const result = await this.pool.query(`UPDATE applications SET company=$3, role=$4, status=$5, date_applied=$6, job_description=$7, notes=$8, url=$9, updated_at=now(), needs_followup=CASE WHEN $5 <> 'Applied' THEN false ELSE needs_followup END
      WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId, input.company, input.role, input.status, input.dateApplied, input.jobDescription, input.notes, input.url]);
    return result.rows[0] && mapApplication(result.rows[0]);
  }
  async updateStatus(userId: string, id: string, status: ApplicationStatus) {
    const result = await this.pool.query(`UPDATE applications SET status=$3, updated_at=now(), needs_followup=CASE WHEN $3 <> 'Applied' THEN false ELSE needs_followup END
      WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId, status]);
    return result.rows[0] && mapApplication(result.rows[0]);
  }
  async remove(userId: string, id: string) { const result = await this.pool.query("DELETE FROM applications WHERE id=$1 AND user_id=$2", [id, userId]); return result.rowCount === 1; }
  async flagStaleApplications(days: number) { const result = await this.pool.query("UPDATE applications SET needs_followup=true WHERE status='Applied' AND date_applied <= CURRENT_DATE - $1::integer AND needs_followup=false", [days]); return result.rowCount ?? 0; }
}

export class MemoryApplicationStore implements ApplicationStore {
  private items: Application[] = [];
  async list(userId: string) { return this.items.filter(item => item.userId === userId); }
  async find(userId: string, id: string) { return this.items.find(item => item.userId === userId && item.id === id); }
  async create(userId: string, input: ApplicationInput) { const now = new Date().toISOString(); const item: Application = { id: randomUUID(), userId, ...input, needsFollowup: false, createdAt: now, updatedAt: now }; this.items.unshift(item); return item; }
  async update(userId: string, id: string, input: ApplicationInput) { const item = await this.find(userId, id); if (!item) return undefined; Object.assign(item, input, { updatedAt: new Date().toISOString(), needsFollowup: input.status === "Applied" ? item.needsFollowup : false }); return item; }
  async updateStatus(userId: string, id: string, status: ApplicationStatus) { const item = await this.find(userId, id); if (!item) return undefined; item.status = status; item.updatedAt = new Date().toISOString(); if (status !== "Applied") item.needsFollowup = false; return item; }
  async remove(userId: string, id: string) { const size = this.items.length; this.items = this.items.filter(item => !(item.userId === userId && item.id === id)); return this.items.length !== size; }
  async flagStaleApplications(days: number) { const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); let count = 0; this.items.forEach(item => { if (item.status === "Applied" && item.dateApplied && new Date(item.dateApplied) <= cutoff && !item.needsFollowup) { item.needsFollowup = true; count++; } }); return count; }
}
