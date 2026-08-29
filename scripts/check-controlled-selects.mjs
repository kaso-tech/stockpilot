import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(process.cwd(), "client/src");
const findings = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      const source = readFileSync(path, "utf8");
      source.split("\n").forEach((line, index) => {
        if (/value=\{[^}]*undefined[^}]*\}/.test(line)) findings.push(`${relative(process.cwd(), path)}:${index + 1}`);
      });
    }
  }
}

walk(root);
if (findings.length) throw new Error(`Sélecteur potentiellement contrôlé/non contrôlé : ${findings.join(", ")}`);
console.log(JSON.stringify({ checkedDirectory: "client/src", controlledSelects: "stable" }));
