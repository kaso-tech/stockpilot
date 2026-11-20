import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const requiredDocuments = [
  "REGISTRE_PREPARATION_LANCEMENT.md",
  "RESUME_CONTINUITE_PROJET.md",
  "PLAN_REMEDIATION_PRODUCTION_STOCKPILOT_2026-08-27.md",
  "AUDIT_GLOBAL_STOCKPILOT_2026-08-27.md",
  "client/src/pages/PrivacyPolicy.tsx",
  "client/src/pages/TermsOfUse.tsx",
  "client/src/pages/SecurityPolicy.tsx",
];

const missing = requiredDocuments.filter(file => !existsSync(resolve(root, file)));
if (missing.length) throw new Error(`Documents de préparation au lancement absents : ${missing.join(", ")}`);

const launchRegister = readFileSync(resolve(root, "REGISTRE_PREPARATION_LANCEMENT.md"), "utf8");
const unresolvedItems = [...launchRegister.matchAll(/^- \[ \] (.+)$/gm)].map(match => match[1]);

console.log(JSON.stringify({
  technicalRegister: "present",
  externalPrerequisites: unresolvedItems.length,
  commercialLaunchStatus: unresolvedItems.length ? "pilot_only" : "review_required",
}, null, 2));
