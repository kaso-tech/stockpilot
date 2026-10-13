// Contrôle à exécuter AVANT la migration 0044 : elle échoue si deux comptes partagent un e-mail.
// Usage : DATABASE_URL=mysql://… node scripts/preflight-lot4.mjs
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est requis.");
  process.exit(2);
}
const connection = await mysql.createConnection(url);
try {
  const [duplicates] = await connection.query(
    "SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS total, GROUP_CONCAT(id) AS ids FROM users WHERE email IS NOT NULL GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1"
  );
  if (duplicates.length) {
    console.error("E-mails en double à corriger avant la migration 0044 :");
    for (const row of duplicates)
      console.error(`  ${row.email} → utilisateurs ${row.ids}`);
    process.exit(1);
  }
  console.log(
    "Aucun e-mail en double : la migration 0044 peut être appliquée."
  );
} finally {
  await connection.end();
}
