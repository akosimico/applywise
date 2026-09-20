import dns from "node:dns/promises";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is missing from .env");
  process.exitCode = 1;
} else {
  const url = new URL(connectionString);
  const [user] = url.username.split(":");
  console.log("Applywise database diagnostic");
  console.log(`  Host: ${url.hostname}`);
  console.log(`  Port: ${url.port || "5432"}`);
  console.log(`  User: ${decodeURIComponent(user)}`);
  console.log(`  Database: ${url.pathname.replace(/^\//, "")}`);
  console.log(`  Password supplied: ${Boolean(url.password)} (value hidden)`);

  try {
    const addresses = await dns.lookup(url.hostname, { all: true });
    console.log(`  DNS: ${addresses.map(address => `${address.address} (IPv${address.family})`).join(", ")}`);
  } catch (error) {
    console.log(`  DNS lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query<{ current_user: string; current_database: string }>("SELECT current_user, current_database()");
    console.log("  Connection: successful");
    console.log(`  Server user: ${result.rows[0].current_user}`);
    console.log(`  Server database: ${result.rows[0].current_database}`);
    const tables = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    console.log(`  Public tables: ${tables.rows.map(row => row.tablename).join(", ") || "none"}`);
  } catch (error) {
    const dbError = error as { message?: string; code?: string; severity?: string; detail?: string; hint?: string };
    console.error("  Connection: failed");
    console.error(`  Message: ${dbError.message ?? String(error)}`);
    if (dbError.code) console.error(`  Postgres code: ${dbError.code}`);
    if (dbError.severity) console.error(`  Severity: ${dbError.severity}`);
    if (dbError.detail) console.error(`  Detail: ${dbError.detail}`);
    if (dbError.hint) console.error(`  Hint: ${dbError.hint}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

