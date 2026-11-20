import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "server");
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
}

walk(root);
const findings = [];
const riskyPattern = /where\(\s*(?:and\(\s*)?eq\(\s*([A-Za-z_$][\w$]*)\.id\s*,\s*(?:input|item|row|record)\./;

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(riskyPattern);
    if (match && !line.includes("companyScope") && !line.includes("scopedResourceId")) {
      findings.push({ file: path.relative(process.cwd(), file), line: index + 1, table: match[1], text: line.trim() });
    }
  });
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  scannedFiles: files.length,
  findings,
  note: "Heuristic report only: every finding requires human review; absence of a finding is not proof of tenant isolation."
}, null, 2));

if (process.argv.includes("--strict") && findings.length > 0) process.exitCode = 1;
