import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const journalPath = resolve(root, "drizzle/meta/_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const missing = [];
const empty = [];

for (const entry of journal.entries ?? []) {
  const migrationPath = resolve(root, "drizzle", `${entry.tag}.sql`);
  if (!existsSync(migrationPath)) missing.push(entry.tag);
  else if (statSync(migrationPath).size === 0) empty.push(entry.tag);
}

if (missing.length || empty.length) {
  throw new Error(`Migration artifacts invalid: missing=${missing.join(",") || "none"}; empty=${empty.join(",") || "none"}`);
}

console.log(JSON.stringify({ migrationCount: journal.entries?.length ?? 0, status: "ok" }));
