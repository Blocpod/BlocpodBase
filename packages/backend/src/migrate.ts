import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 1 });
const migrationUrl = new URL("../migrations/001_initial.sql", import.meta.url);

try {
  await sql.unsafe(await readFile(fileURLToPath(migrationUrl), "utf8"));
  process.stdout.write(`${JSON.stringify({ level: "info", event: "database.migrated" })}\n`);
} finally {
  await sql.end({ timeout: 5 });
}
