// Audit statique d'isolation multi-entreprise (heuristique).
// Usage : node scripts/audit-tenant-scope.mjs [--strict]
// Une occurrence volontaire peut être justifiée par le commentaire `tenant-scope-ok: <raison>` sur la même ligne.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "server");
const schema = fs.readFileSync(
  path.resolve(process.cwd(), "drizzle", "schema.ts"),
  "utf8"
);

/** Tables portant une colonne companyId, d'après le schéma Drizzle. */
const companyTables = new Set();
// Découpage par déclaration exportée : indépendant de la mise en forme du schéma.
for (const chunk of schema.split(/\nexport const /).slice(1)) {
  const name = chunk.match(/^(\w+)\s*=\s*mysqlTable\(/)?.[1];
  if (name && /\bcompanyId: int\("companyId"\)/.test(chunk))
    companyTables.add(name);
}
if (companyTables.size < 15)
  throw new Error(
    `Analyse du schéma suspecte : seulement ${companyTables.size} tables d'entreprise détectées.`
  );
// Tables lues par clé globale avant que l'entreprise ne soit connue (authentification, planification).
const globalLookups = new Set(["users", "backupSettings"]);

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "test") walk(fullPath);
    } else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name))
      files.push(fullPath);
  }
}
walk(root);

const findings = [];
const report = (file, source, offset, rule, text) => {
  const line = source.slice(0, offset).split("\n").length;
  // La justification peut figurer n'importe où dans l'instruction (le formateur
  // la déplace parfois en fin d'instruction) : on lit jusqu'à la fin de ligne qui suit le « ; ».
  const lineStart = source.lastIndexOf("\n", offset) + 1;
  const semicolon = source.indexOf(";", offset);
  const end = source.indexOf("\n", semicolon === -1 ? offset : semicolon);
  if (
    source
      .slice(lineStart, end === -1 ? undefined : end)
      .includes("tenant-scope-ok")
  )
    return;
  findings.push({
    file: path.relative(process.cwd(), file),
    line,
    rule,
    text: text.replace(/\s+/g, " ").slice(0, 180),
  });
};

/** Extrait l'instruction qui commence à `offset` (jusqu'au prochain point-virgule hors parenthèses). */
function statementFrom(source, offset) {
  let depth = 0;
  for (let index = offset; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      if (depth < 0) return source.slice(offset, index);
    } else if (char === ";" && depth <= 0) return source.slice(offset, index);
  }
  return source.slice(offset);
}

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  // 1. Lecture/écriture d'une table d'entreprise sans filtre d'entreprise.
  for (const match of source.matchAll(/\.(from|update|delete)\((\w+)\)/g)) {
    const table = match[2];
    if (!companyTables.has(table)) continue;
    const statement = statementFrom(source, match.index + match[0].length);
    const scoped =
      /companyScope\(|scopedResourceId\(|\.companyId\s*,|inArray\(|\bcompanyId\b/.test(
        statement.split(/\.(?:from|update|delete)\(/)[0]
      );
    if (scoped) continue;
    if (
      match[1] === "from" &&
      globalLookups.has(table) &&
      /eq\((?:users\.(?:openId|id)|backupSettings\.scheduleCronTaskUid)/.test(
        statement
      )
    )
      continue;
    report(
      file,
      source,
      match.index,
      `${match[1]}-without-company-scope`,
      `${match[0]}${statement.slice(0, 140)}`
    );
  }

  // 2. Insertion dans une table d'entreprise sans companyId.
  for (const match of source.matchAll(/\.insert\((\w+)\)\.values\(/g)) {
    const table = match[1];
    if (!companyTables.has(table)) continue;
    const values = statementFrom(source, match.index + match[0].length);
    if (
      /\bcompanyId\b/.test(values) ||
      /^\s*(rows|tiers|values|input|data)\b/.test(values) ||
      /\.\.\.(input|data|values|agentData|productData)\b/.test(values)
    )
      continue;
    report(
      file,
      source,
      match.index,
      "insert-without-companyId",
      `${match[0]}${values.slice(0, 140)}`
    );
  }

  // 3. Motif historique : ressource chargée par identifiant reçu sans filtre d'entreprise.
  for (const match of source.matchAll(
    /where\(\s*(?:and\(\s*)?eq\(\s*([A-Za-z_$][\w$]*)\.id\s*,\s*(?:input|item|row|record)\./g
  )) {
    // L'instruction complète (éventuellement sur plusieurs lignes) doit contenir le filtre.
    const whereClause = statementFrom(source, match.index + "where(".length);
    if (
      !whereClause.includes("companyScope") &&
      !whereClause.includes("scopedResourceId") &&
      companyTables.has(match[1])
    )
      report(
        file,
        source,
        match.index,
        "id-lookup-without-company-scope",
        match[0]
      );
  }
}

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scannedFiles: files.length,
      companyTables: Array.from(companyTables).sort(),
      findings,
      note: "Rapport heuristique : chaque constat doit être revu ; l'absence de constat ne prouve pas l'isolation.",
    },
    null,
    2
  )
);

if (process.argv.includes("--strict") && findings.length > 0)
  process.exitCode = 1;
