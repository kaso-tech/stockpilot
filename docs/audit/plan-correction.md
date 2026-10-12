# Plan de correction — suite de l'audit du 12/10/2026

Référence : `docs/audit/audit-complet-2026-10-12.md` (les identifiants S1, E5, etc. renvoient à ce rapport).

Règles d'exécution :
- un lot = un ou plusieurs commits atomiques, `pnpm check` + `pnpm test` + `pnpm build` verts avant chaque push ;
- toute migration de schéma est livrée en SQL Drizzle versionné et doit être appliquée en préproduction après sauvegarde ;
- le statut de chaque lot est tenu à jour dans le tableau ci-dessous.

| Lot | Objet | Constats couverts | Statut |
|---|---|---|---|
| 1 | CI verte et correctifs de sécurité rapides | E20, E21, S2, S3, S4, S7, B1, H2, H3, E16, E17, E11 | ✅ Fait |
| 2 | Authentification, sessions, CSRF, en-têtes, limitation de débit | A1–A8, A4, H1, H4, B6 (doc) | 🔄 En cours |
| 3 | Concurrence et intégrité du stock et des encaissements | E1, E2, E3, E9, E13 | ⬜ À faire |
| 4 | Schéma multi-entreprise (contraintes UNIQUE, index) | S1, A8, S8 (partiel) | ⬜ À faire |
| 5 | Sauvegardes complètes, restauration validée, stockage, Drive | E14, E15, S6, B2, B3, B4, B5 | ⬜ À faire |
| 6 | Code mort et dépendances (mise à jour + retrait) | §4, §2.5 | ⬜ À faire |
| 7 | Corrections fonctionnelles (tableau de bord, fuseau horaire, pagination, inventaire, numérotation, remboursements) | E4–E8, E10, E12, E18 (partiel) | ⬜ À faire |
| 8 | Performance et qualité (lazy loading, écritures par requête, requêtes non bornées, CI) | P1–P6, P10–P11, E22–E24 | ⬜ À faire |
| 9 | Fonctionnalités manquantes (feuille de route, nécessite arbitrages produit) | §6 | ⏳ À planifier avec le métier |

Le détail des modifications de chaque lot est consigné dans la section « Journal » ci-dessous au fil de l'eau.

## Journal

### Lot 1 — CI verte et correctifs de sécurité rapides

- **E20** : `auth.sessions.test.ts` fige l'horloge (`vi.setSystemTime`) ; la suite ne dépend plus de la date du jour.
- **Migrations** (découvert pendant le lot) : `0020_living_scarlet_spider.sql` contenait deux instructions sans `--> statement-breakpoint` ; une base vierge ne pouvait pas être installée. Corrigé (sans effet sur une base déjà migrée : Drizzle s'appuie sur l'horodatage, pas sur le contenu). Les 44 migrations s'appliquent désormais sur MySQL 8.4 et `drizzle-kit generate` ne détecte aucune dérive du schéma.
- **E21 / E22** : la CI démarre un service MySQL 8.4, applique les migrations, lance `pnpm test:db` (tests d'intégration réels, `vitest.db.config.ts`, exécution séquentielle) et vérifie la cohérence journal/SQL/snapshots (`scripts/check-migrations.mjs`) au lieu de tester la présence de `0041`.
- **S2** : `products.create/update` vérifient que le fournisseur appartient à l'entreprise ; `products.detail` filtre le fournisseur par entreprise.
- **S3** : `products.updatePurchasePrice` lit les réglages de l'entreprise de l'utilisateur.
- **S4** : `createAudit` et `audit()` reçoivent l'acteur `{ id, companyId }` ; les écritures d'audit des sauvegardes et des dépenses renseignent `companyId`.
- **S7** : `payroll.pay` vérifie que le bénéficiaire appartient à l'entreprise ; montants bornés par `MAX_CENTS` (paie, dépenses, budget).
- **B1** : `backups.runNow` réservé aux administrateurs.
- **§4.1** : suppression de l'ancien chemin `commerce.sales.create` (facture « payée » sans paiement) et de `commerce.sales.list` inutilisé.
- **E11** : seules les violations d'unicité MySQL deviennent `CONFLICT` (`server/dbErrors.ts`) ; les autres erreurs remontent telles quelles.
- **H2** : limite de corps 1 Mo hors `/api/trpc` (32 Mo sur tRPC, nécessaire à la restauration ; à réduire au lot 5 avec un upload dédié).
- **H3 / H4 (partiel)** : `escapeHtml` mutualisé (`client/src/lib/html.ts`) et appliqué à l'impression des alertes ; URL de reçus limitées au stockage interne ou à `https:` (`server/inputRules.ts`).
- **E16** : `navigateFallbackDenylist` pour `/api/` et `/manus-storage/` dans le service worker.
- **E17** : la synchronisation hors connexion utilise `COOKIE_NAME`.
- Tests ajoutés : `server/test/lot1.tenant.db.test.ts` (6 scénarios A/B sur MySQL réel), `dbErrors.test.ts`, `inputRules.test.ts`, `client/src/lib/html.test.ts`.
