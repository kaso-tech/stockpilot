const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const checks = [];
async function check(path, predicate, label) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const body = await response.text();
  const result = predicate(response, body);
  checks.push({ label, status: response.status, passed: result });
  if (!result) throw new Error(`${label} failed with status ${response.status}`);
}
await check("/", (response, body) => response.status === 200 && body.includes("StockPilot"), "public root");
await check("/api/trpc/dashboard.get", response => response.status === 401 || response.status === 403, "protected dashboard route");
await check("/api/trpc/backups.get", response => response.status === 401 || response.status === 403, "protected backups route");
console.log(JSON.stringify({ baseUrl, checks }, null, 2));
