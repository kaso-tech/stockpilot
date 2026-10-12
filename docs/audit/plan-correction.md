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
| 4 | Schéma multi-entreprise (contraintes UNIQUE, index) | S1, A8, S5, S8 (partiel), E19 | ✅ Fait |
| 5 | Sauvegardes complètes, restauration validée, stockage, Drive | E14, E15, S6, B2, B3, B4, B5 | ✅ Fait (B2 partiel) |
| 6 | Code mort et dépendances (mise à jour + retrait) | §4, §2.5, H5 | ✅ Fait |
| 7 | Corrections fonctionnelles (tableau de bord, fuseau horaire, pagination, inventaire, numérotation, remboursements) | E4–E8, E10, E12, E18 | ✅ Fait |
| 8 | Performance et qualité (lazy loading, écritures par requête, requêtes non bornées, CI) | P1–P6, P10–P11, E22–E24 | 🔄 En cours |
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

### Lot 4 — Schéma multi-entreprise

Migration **`0044_tenant_scoped_uniques`** (testée sur une base 0043 contenant des données historiques) :
1. rattache les entrées d'audit orphelines (bogue S4) à l'entreprise de leur auteur ;
2. **S5** : convertit le locataire historique (`companyId = NULL`) en une vraie entreprise (nom repris des réglages, propriétaire = premier administrateur, assistant de démarrage marqué terminé) et y rattache toutes ses lignes dans les 20 tables concernées ;
3. supprime les doublons de réglages de vente et de sauvegarde (le plus ancien est conservé) ;
4. **S1** : remplace les `UNIQUE` globaux par des `UNIQUE(companyId, …)` sur produits (référence), fournisseurs, catégories, unités et budgets ; `UNIQUE(companyId)` sur les réglages de vente et de sauvegarde ;
5. **A8** : `UNIQUE(email)` sur `users` (insensible à la casse avec la collation par défaut) ;
6. index manquants : paliers de prix, lignes de bons de commande, lignes d'inventaire, commissions, paiements d'agents, clients, bons de commande, dépenses.

Code : `protectedProcedure` et `adminProcedure` refusent un compte sans entreprise. Les utilisateurs historiques bénéficient désormais du mode hors connexion (**E19**).

**Procédure de déploiement :** sauvegarde complète → `DATABASE_URL=… node scripts/preflight-lot4.mjs` (échoue s'il existe des e-mails en double, à fusionner manuellement) → `pnpm exec drizzle-kit migrate`.

**Non traité volontairement :** `sellerCredentials.username` reste unique globalement (l'identifiant interne n'est plus utilisé pour se connecter depuis le lot 2) ; les clés étrangères (S8) seront ajoutées après nettoyage des orphelins éventuels, dans un lot ultérieur.

Tests : `server/test/lot4.schema.db.test.ts` (4 scénarios).

### Lot 5 — Sauvegardes, restauration, Google Drive

- **Bogue critique découvert** : l'ancienne restauration transmettait les dates de l'archive sous forme de texte à Drizzle (`value.toISOString is not a function`) : **aucune archive réelle ne pouvait être restaurée**. Les valeurs sont désormais converties selon le type de chaque colonne.
- **E14** : format d'archive **version 2** couvrant les 27 tables métier de l'entreprise (paliers de prix, catégories, unités, paiements, bons de commande et leurs lignes, dépenses, budgets, préférences, mots de passe administrateurs…). Les archives version 1 restent restaurables (seules leurs 17 tables sont alors remplacées).
- **E15** : la restauration supprime puis réinsère l'ensemble des tables dans une transaction, enfants compris ; elle refuse une archive qui ne contient pas le compte administrateur actif de la personne qui restaure (verrouillage impossible).
- **S6** : validation stricte de l'archive : colonnes connues uniquement, types contrôlés, toutes les références (produits, clients, vendeurs, agents, fournisseurs, ventes…) doivent pointer vers des lignes présentes dans l'archive : une archive forgée ne peut plus viser les données d'une autre entreprise.
- **B2 (partiel)** : l'API de stockage Manus n'offre pas de suppression ; les fichiers d'archives périmés ne peuvent donc pas être effacés physiquement. Mesure compensatoire : avec `BACKUP_ENCRYPTION_KEY`, les archives sont **chiffrées (AES-256-GCM)** au repos et sur Google Drive, illisibles sans la clé. À compléter dès qu'une API de suppression est disponible (ou en migrant vers S3, déjà en dépendance).
- **B3** : clé dédiée `DRIVE_TOKEN_ENCRYPTION_KEY` pour les jetons Drive, relecture des jetons existants avec l'ancienne clé, plus aucune clé codée en dur (`server/secretBox.ts`).
- **B4** : `PUBLIC_APP_URL` pour une URI de retour OAuth fixe (le protocole est de toute façon correct grâce à `trust proxy`) ; le `state` OAuth expire après 10 minutes.
- **B5** : un échec de copie Drive n'est plus présenté comme une sauvegarde ratée : l'archive est conservée, l'erreur Drive est indiquée sur l'archive et dans le statut.
- La rétention ne compte plus les tentatives échouées.
- Ajout de `.env.example` documentant toutes les variables d'environnement.
- Tests : `server/test/lot5.backups.db.test.ts` (aller-retour complet, chiffrement, archive forgée, protection de l'administrateur, API tRPC), tests OAuth Drive.

### Lot 6 — Code mort et dépendances

**Dépendances**
- Découverte : avec pnpm 10.4, les `overrides` et le correctif `wouter` déclarés dans `pnpm-workspace.yaml` **n'étaient jamais appliqués** (absents du lockfile). Les surcharges sont désormais dans `package.json > pnpm.overrides`. Le correctif wouter (outil Manus qui recensait les routes dans `window`) est supprimé.
- Mises à jour : `drizzle-orm` 0.45, `mysql2` 3.24, `@trpc/*` 11.19, `axios` 1.20, `express` 4.22, `vite` 7.3, `tailwindcss` 4.3, `vite-plugin-pwa` 2, `vitest` 4, `drizzle-kit`, `esbuild` ; surcharges pour `proxy-addr`, `path-to-regexp`, `qs`, `body-parser`, `lodash`, `dompurify`, `postcss`, `picomatch`, `brace-expansion`, `fast-uri`, `source-map-js`.
- Retirées (inutilisées) : `@aws-sdk/*`, `streamdown`, `framer-motion`, `date-fns`, `react-hook-form`, `@hookform/resolvers`, `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `vaul`, `tailwindcss-animate`, `@tailwindcss/typography`, 15 paquets `@radix-ui/*`, `@types/google.maps`, `autoprefixer`, `postcss`, `add`, `pnpm` (dépendance de dev), `@builder.io/vite-plugin-jsx-loc`.
- **`pnpm audit --prod` : 0 vulnérabilité** (70 avant). Toutes dépendances confondues : 1 modérée restante (esbuild embarqué par drizzle-kit, outil en ligne de commande local).

**Code mort supprimé**
- Serveur : `_core/llm.ts`, `map.ts`, `voiceTranscription.ts`, `imageGeneration.ts`, `dataApi.ts`, `notification.ts` ; endpoints `system.notifyOwner`, `commerce.remuneration.*`, `users.*`, `backups.removeArchive` ; flux OAuth Manus inutilisé dans `sdk.ts` et `shared/const.ts` ; `listUsers` ; bloc commenté de `cookies.ts`.
- Client : `AIChatBox`, `Map`, `lib/offlineCache`, 34 composants `components/ui/*` inutilisés ; restes de partage de bons dans `SupplierDetail` (déplacé dans `PurchaseOrderDetail`) ; imports et variables inutilisés.
- `client/dev-dist/` retiré du dépôt et ignoré ; le collecteur de debug Manus est servi uniquement par le serveur de développement (plus copié dans le build).
- `noUnusedLocals` activé dans `tsconfig.json` pour empêcher le retour d'imports morts.

**Bogue révélé par le nettoyage** : la fonction `edit` de la page Agents n'était reliée à aucun bouton : la **conversion agent ↔ vendeur était inaccessible**. Un bouton « Modifier ou convertir » est ajouté sur chaque fiche.

**H5** : le script d'analytics n'est injecté que si `VITE_ANALYTICS_ENDPOINT` et `VITE_ANALYTICS_WEBSITE_ID` sont définis.

Bundle principal : 2,04 Mo → 1,83 Mo (le découpage par page arrive au lot 8).

### Lot 7 — Corrections fonctionnelles

Migration **`0045_sequences_timezone_credit_notes`** : table `documentSequences`, unicité des numéros **par entreprise** (`sales`, `purchaseOrders`), colonnes `sales.creditNoteNumber` / `refundedAt`, `saleSettings.timezone` (défaut `Africa/Abidjan`, UTC+0).

- **E4** : le tableau de bord charge les commissions (via les ventes de l'entreprise) et les paiements d'agents pour toutes les entreprises : « paie due » et dépenses d'agents sont justes.
- **E5** : numérotation continue par entreprise, série et année : `FAC-2026-000001`, `POS-…`, `DEV-…`, `AV-…` (avoirs), `BC-…` (bons de commande). Le compteur est incrémenté dans la transaction du document (aucun doublon en parallèle, aucun trou en cas d'échec). Une facture non encaissée n'est plus supprimée mais **annulée** (seuls les devis restent supprimables). Les numéros existants ne sont pas renumérotés.
- **E6** : fuseau horaire par entreprise (Paramètres › Devise) utilisé pour « aujourd'hui », le mois en cours, les tendances, la paie, les dépenses et l'année de numérotation (`server/companyTime.ts`).
- **E8** : un remboursement émet un **avoir numéroté**, enregistre un paiement négatif (la caisse reste juste), contrepasse les commissions au lieu de les effacer et conserve la facture (statut annulé, date de remboursement). L'avoir est affiché sur la facture.
- **E10** : les commissions sont calculées sur la part réellement encaissée à chaque règlement (acompte puis solde).
- **E12** : `transactions.list` filtre par canal côté serveur (les devis n'étaient plus visibles au-delà des 100 dernières ventes tous canaux confondus) ; limite extensible et bouton « Charger plus » sur Factures, Devis, Mouvements, Journal d'audit et Historique des paramètres.
- **E18** : une opération hors connexion bloquée peut être **retirée de la file** depuis le journal de synchronisation (statut « Retirée », conservée pour la traçabilité), après régularisation manuelle.
- **E7, E9** : traités au lot 3.
- Tests : `server/test/lot7.functional.db.test.ts` (6 scénarios), `server/companyTime.test.ts`.

**Restent à arbitrer (lot 9)** : remboursements partiels ligne à ligne et avoirs partiels (nécessitent un écran de sélection des articles).
