// Vérifie la cohérence entre le journal Drizzle, les fichiers SQL et les snapshots.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "drizzle");
const journal = JSON.parse(
  readFileSync(path.join(root, "meta", "_journal.json"), "utf8")
);
const errors = [];
const tags = new Set();

journal.entries.forEach((entry, index) => {
  if (entry.idx !== index)
    errors.push(`Index ${entry.idx} hors séquence (attendu ${index}).`);
  tags.add(entry.tag);
  const sqlFile = path.join(root, `${entry.tag}.sql`);
  if (!existsSync(sqlFile) || statSync(sqlFile).size === 0)
    errors.push(`Migration SQL absente ou vide : ${entry.tag}.sql`);
  const snapshot = path.join(
    root,
    "meta",
    `${String(entry.idx).padStart(4, "0")}_snapshot.json`
  );
  if (!existsSync(snapshot)) errors.push(`Snapshot absent pour ${entry.tag}.`);
});

for (const file of readdirSync(root).filter(name => name.endsWith(".sql"))) {
  if (!tags.has(file.replace(/\.sql$/, "")))
    errors.push(`Fichier SQL non référencé dans le journal : ${file}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Migrations cohérentes : ${journal.entries.length} entrées.`);
