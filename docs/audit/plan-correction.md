# Plan de correction — suite de l'audit du 12/10/2026

Référence : `docs/audit/audit-complet-2026-10-12.md` (les identifiants S1, E5, etc. renvoient à ce rapport).

Règles d'exécution :
- un lot = un ou plusieurs commits atomiques, `pnpm check` + `pnpm test` + `pnpm build` verts avant chaque push ;
- toute migration de schéma est livrée en SQL Drizzle versionné et doit être appliquée en préproduction après sauvegarde ;
- le statut de chaque lot est tenu à jour dans le tableau ci-dessous.

| Lot | Objet | Constats couverts | Statut |
|---|---|---|---|
| 1 | CI verte et correctifs de sécurité rapides | E20, E21, S2, S3, S4, S7, B1, H2, H3, E16, E17, E11 | ✅ Fait |
| 2 | Authentification, sessions, CSRF, en-têtes, limitation de débit | A1–A8, A4, H1, H4, B6 (doc) | ✅ Fait |
| 3 | Concurrence et intégrité du stock et des encaissements | E1, E2, E3, E9, E13 | ✅ Fait |
| 4 | Schéma multi-entreprise (contraintes UNIQUE, index) | S1, A8, S8 (partiel) | 🔄 En cours |
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

### Lot 2 — Authentification, sessions, CSRF, en-têtes

- **A1 / A7** : suppression de `auth.localLogin` et `auth.adminFallbackLogin` (sans interface, sessions d'un an non suivies) et du module `adminFallbackAuth`. `authenticateRequest` refuse désormais tout jeton utilisateur sans `sessionId` suivi en base : **les anciens jetons « legacy » sont invalidés, les utilisateurs concernés devront se reconnecter une fois.** Le changement de mot de passe administrateur n'accepte plus le secret d'environnement.
- **A2** : `trust proxy` configuré (`TRUST_PROXY`, 1 saut par défaut) ; la limitation s'appuie sur `req.ip`, plus jamais sur `X-Forwarded-For` brut.
- **A3** : le limiteur évince les entrées les plus anciennes quand il est saturé au lieu de refuser tout le monde.
- **A4** : les mutations `/api/trpc` exigent `Content-Type: application/json` (`server/_core/httpSecurity.ts`) : un formulaire d'un site tiers ne peut plus déclencher d'action.
- **A5** : limitation sur `emailAvailability` (20 / 15 min) et `registerCompany` (5 / h par IP) ; vérification de mot de passe factice quand le compte n'existe pas (temps de réponse constant).
- **A6** : révocation des sessions lors d'un changement de mot de passe ou d'e-mail vendeur, d'une désactivation, d'une conversion en agent, d'un changement de rôle et d'un changement de mot de passe administrateur. `sellers.remove` vérifie l'appartenance à l'entreprise.
- **A8** : recherche des comptes par e-mail en SQL (`lower(email) = ?`) au lieu de charger tous les utilisateurs (l'index unique arrive au lot 4).
- **H1** : en-têtes `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP `frame-ancestors` (configurable via `FRAME_ANCESTORS`), `HSTS` en production, `x-powered-by` retiré.
- **H4** : SVG refusé pour logo et signature (serveur et client) ; URL de logo/signature validées.
- **B6** : la planification Manus reste liée au jeton de l'administrateur (contrainte de la plateforme) ; documenté, à revoir si l'hébergement change.
- Tests : `server/test/lot2.auth.db.test.ts` (8 scénarios MySQL), `server/_core/httpSecurity.test.ts`, test de saturation du limiteur. Les anciens tests à base de simulations devenus obsolètes ont été remplacés.

**Variables d'environnement nouvelles :** `TRUST_PROXY` (défaut `1`), `FRAME_ANCESTORS` (défaut `'self'`).

### Lot 3 — Concurrence et intégrité du stock et des encaissements

- **E1** : `checkout`, `refund` et `removeDraft` verrouillent la vente (`SELECT … FOR UPDATE`) dans la transaction ; un encaissement concurrent attend puis relit le statut. Vérifié : l'ancien code encaissait **3 fois** la même vente sous 3 requêtes simultanées, le nouveau une seule.
- **E2** : nouveau module `server/stockLedger.ts` (`lockProducts` + `StockLedger.apply`) : verrouille les produits, calcule la quantité courante ligne après ligne, écrit le mouvement et synchronise l'alerte. Utilisé par l'encaissement, le remboursement, les mouvements manuels, la réception des bons de commande (bon verrouillé également), la validation d'inventaire et la modification de fiche produit.
- **E3** : une vente ou un remboursement avec plusieurs lignes du même produit fonctionne (identifiants dédoublonnés, quantité suivie par le registre).
- **E7** : le stock théorique d'une ligne d'inventaire est figé au moment du comptage ; la validation applique l'écart (compté − théorique) au stock courant. Comptage impossible sur un inventaire validé.
- **E9** : modifier la quantité depuis la fiche produit crée un mouvement d'ajustement tracé.
- **E13** : bornes `MAX_CENTS` / `MAX_QUANTITY` sur les prix et quantités produit, paliers, mouvements, réceptions, comptages, rémunérations fixes ; 10 paiements maximum par encaissement.
- Les erreurs de stock (stock négatif…) remontent en `BAD_REQUEST` avec le nom du produit au lieu d'une erreur 500.
- Tests : `server/test/lot3.stock.db.test.ts` (7 scénarios dont encaissements et réceptions concurrents). Les anciens tests simulés incompatibles avec les verrous ont été remplacés.
