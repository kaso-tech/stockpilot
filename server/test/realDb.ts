import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { TrpcContext } from "../_core/context";
import type { AuthenticatedUser } from "../_core/sdk";

/**
 * Harnais d'intégration sur une vraie base MySQL migrée.
 * Activé uniquement si TEST_DATABASE_URL est défini (CI ou poste local) :
 *   TEST_DATABASE_URL=mysql://root:root@127.0.0.1:3306/stockpilot pnpm test
 */
export const realDbUrl = process.env.TEST_DATABASE_URL;
if (realDbUrl) process.env.DATABASE_URL = realDbUrl;

export async function realDb() {
  const db = await getDb();
  if (!db)
    throw new Error(
      "TEST_DATABASE_URL est requis pour les tests d'intégration."
    );
  return db;
}

/** Vide toutes les tables applicatives (hors journal de migrations). */
export async function resetDatabase() {
  const db = await realDb();
  const [rows] = (await db.execute(
    sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '__drizzle_migrations'`
  )) as unknown as [Array<{ name: string }>];
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const row of rows)
    await db.execute(sql.raw(`TRUNCATE TABLE \`${row.name}\``));
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}

export type SeededTenant = {
  companyId: number;
  admin: AuthenticatedUser;
  seller: AuthenticatedUser;
};

/** Crée une entreprise avec un administrateur, un vendeur et ses réglages. */
export async function seedTenant(slug: string): Promise<SeededTenant> {
  const db = await realDb();
  const { companies, saleSettings, users } = await import(
    "../../drizzle/schema"
  );
  const { eq } = await import("drizzle-orm");
  const companyId = Number(
    (
      await db
        .insert(companies)
        .values({ name: `Entreprise ${slug}` })
        .$returningId()
    )[0]!.id
  );
  await db
    .insert(saleSettings)
    .values({ companyId, companyName: `Entreprise ${slug}` });
  const make = async (role: "admin" | "seller") => {
    const id = Number(
      (
        await db
          .insert(users)
          .values({
            openId: `it-${slug}-${role}`,
            name: `${role} ${slug}`,
            email: `${role}@${slug}.test`,
            role,
            active: true,
            companyId,
            loginMethod: "password",
          })
          .$returningId()
      )[0]!.id
    );
    return (
      await db.select().from(users).where(eq(users.id, id)).limit(1)
    )[0] as AuthenticatedUser;
  };
  return {
    companyId,
    admin: await make("admin"),
    seller: await make("seller"),
  };
}

export function ctx(user: AuthenticatedUser): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}
