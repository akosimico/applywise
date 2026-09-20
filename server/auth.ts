import { randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
export interface User { id: string; email: string; passwordHash: string; }
export interface UserStore { create(email: string, passwordHash: string): Promise<User>; findByEmail(email: string): Promise<User | undefined>; }
export class MemoryUserStore implements UserStore { private users: User[] = []; async create(email: string, passwordHash: string) { const user = { id: randomUUID(), email, passwordHash }; this.users.push(user); return user; } async findByEmail(email: string) { return this.users.find(user => user.email === email); } }
export class PostgresUserStore implements UserStore {
  constructor(private readonly pool: pg.Pool) {}
  async create(email: string, passwordHash: string) { const result = await this.pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1,$2,$3) RETURNING id,email,password_hash", [randomUUID(), email, passwordHash]); return mapUser(result.rows[0]); }
  async findByEmail(email: string) { const result = await this.pool.query("SELECT id,email,password_hash FROM users WHERE email=$1", [email]); return result.rows[0] && mapUser(result.rows[0]); }
}
const mapUser = (row: Record<string, unknown>): User => ({ id: String(row.id), email: String(row.email), passwordHash: String(row.password_hash) });
export async function hashPassword(password: string) { const salt = randomUUID(); return `${salt}:${(await scrypt(password, salt, 64) as Buffer).toString("hex")}`; }
export async function verifyPassword(password: string, saved: string) { const [salt, expected] = saved.split(":"); const actual = (await scrypt(password, salt, 64) as Buffer).toString("hex"); return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex")); }

