// Base vierge et migrée avant les tests de bout en bout (appelé par playwright.config.ts).
import { execSync } from "node:child_process";
import mysql from "mysql2/promise";

const url = new URL(
  process.env.DATABASE_URL ?? "mysql://root:root@127.0.0.1:3306/stockpilot_e2e"
);
const database = url.pathname.slice(1);
if (!/^[\w-]*e2e[\w-]*$/.test(database)) {
  console.error(
    `Refus : la base « ${database} » ne semble pas dédiée aux tests de bout en bout.`
  );
  process.exit(1);
}
const admin = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
});
await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
await admin.query(`CREATE DATABASE \`${database}\``);
await admin.end();
execSync("pnpm exec drizzle-kit migrate", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url.toString() },
});
