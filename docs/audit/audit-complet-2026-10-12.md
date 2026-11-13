# Audit complet — StockPilot Pro

**Date :** 12 octobre 2026
**Révision auditée :** `81833c5` (branche `main`)
**Périmètre :** serveur (Express + tRPC + Drizzle/MySQL), client (React 19 + Vite + PWA), schéma et migrations, CI, dépendances, tests.

---

## 0. Méthode et résultats des contrôles automatiques

| Contrôle | Commande | Résultat |
|---|---|---|
| Typage | `pnpm check` | ✅ 0 erreur |
| Tests | `pnpm test` | ❌ **1 échec** / 181 réussis / 4 ignorés (76 fichiers, dont 2 ignorés) |
| Build | `pnpm build` | ✅ mais bundle JS principal de **2,04 Mo** (551 Ko gzip) et `index.html` de **368 Ko** |
| Audit dépendances | `pnpm audit --prod` | ❌ **70 vulnérabilités** : 2 critiques, 16 hautes, 39 modérées, 13 faibles |
| Secrets en clair dans le dépôt | recherche par motif | ✅ rien trouvé |

Ensuite, lecture manuelle de l'ensemble des routeurs serveur, de l'authentification, des sauvegardes, de l'intégration Google Drive, du schéma, de la couche hors connexion et des impressions côté client.

**Légende de sévérité :** 🔴 Critique · 🟠 Haute · 🟡 Moyenne · 🔵 Faible / qualité

---

## 1. Synthèse

L'application est fonctionnellement riche : point de vente, factures, devis, achats, inventaires, paie, dépenses, sauvegardes, mode hors connexion. Le travail de « remédiation » documenté dans `docs/remediation/` a réellement amélioré l'isolation entre entreprises (helper `companyScope`). **Mais le passage au multi‑entreprise (SaaS) reste incomplet.** Plusieurs défauts structurels empêchent un usage multi‑locataire sûr en production :

1. **Contraintes `UNIQUE` globales** dans le schéma (référence produit, nom de fournisseur, catégorie, unité, mois de budget, alerte de stock). Elles bloquent les entreprises entre elles et révèlent l'existence de données d'un autre locataire.
2. **Journal d'audit mal rattaché** : la majorité des écritures d'audit n'ont pas de `companyId`. Les entreprises SaaS ne voient donc pas leur propre historique, et le locataire « historique » (`companyId = NULL`) voit celui de tout le monde.
3. **Fuites inter‑entreprises ponctuelles** : un fournisseur d'une autre entreprise est lisible via un produit, et les réglages de la première entreprise de la base servent à autoriser une action.
4. **Absence de verrouillage concurrentiel** sur les stocks et les encaissements : double encaissement possible, mises à jour de stock perdues.
5. **Sessions non révocables** pour deux des quatre méthodes de connexion (jeton valable 1 an), contournement trivial de la limitation de débit, et CSRF possible sur les mutations sans paramètre.
6. **Sauvegardes incomplètes** : 12 tables métier ne sont pas sauvegardées (paliers de prix, paiements, bons de commande, dépenses, catégories…). La restauration produit donc une base incohérente.
7. **Dette de dépendances** : 70 vulnérabilités connues, dont des failles critiques ou hautes dans `drizzle-orm`, `mysql2`, `axios`, `express`/`proxy-addr` et `fast-xml-parser`.

---

## 2. Failles de sécurité

### 2.1 Isolation multi‑entreprise

| # | Sév. | Constat | Emplacement |
|---|---|---|---|
| S1 | 🔴 | **Contraintes `UNIQUE` globales au lieu de « par entreprise ».** `products.reference`, `suppliers.name`, `productCategories.name`, `productUnits.name`, `expenseBudgets.yearMonth`, `stockAlerts.productId`, `sellerCredentials.username`. Conséquences : (a) l'entreprise B ne peut pas créer la référence « P001 » si A l'a déjà ; (b) **une seule entreprise de toute la plateforme peut définir un budget pour un mois donné** ; (c) le message « Cette référence produit existe déjà » sert d'oracle pour sonder les données des autres entreprises. | `drizzle/schema.ts:49,67,117,145,153,289,390` |
| S2 | 🟠 | **Fuite des fournisseurs d'une autre entreprise.** `products.create/update` n'impose pas que `supplierId` appartienne à l'entreprise. `products.detail` charge ensuite le fournisseur sans filtre d'entreprise et renvoie son nom, son adresse, son e‑mail et son téléphone. | `server/routers.ts:469` (et `productInput`, pas de contrôle de `supplierId`) |
| S3 | 🟠 | **Réglages d'une autre entreprise utilisés pour autoriser une action.** `updatePurchasePrice` lit `saleSettings` **sans filtre** (`select().from(saleSettings).limit(1)`). L'autorisation « le vendeur peut modifier le coût d'achat » dépend donc des réglages de la première entreprise en base. | `server/routers.ts:507` |
| S4 | 🟠 | **Journal d'audit sans `companyId`.** `createAudit()` (routers.ts), l'audit des sauvegardes (`saveConfiguration`, `runNow`, `removeArchive`), celui des dépenses (`budget.save`, `create`, `update`, `remove`) et celui de `commerce.sales.create` insèrent `companyId = NULL`. Les entreprises SaaS ne voient pas leur historique, et les utilisateurs du locataire historique voient les actions de toutes les entreprises. | `server/routers.ts:131`, `server/routers/backups.ts:35,38,42`, `server/routers/expenses.ts:40,62,69,75`, `server/routers/commerce.ts:184` |
| S5 | 🟡 | **Le modèle « `companyId = NULL` = locataire historique »** fait de toute donnée orpheline (audit, ou tout insert qui oublie `companyId`) une donnée visible par ce locataire. Un oubli d'une seule ligne suffit à créer une fuite. Recommandation : migrer le locataire historique vers une vraie ligne `companies` et passer `companyId` en `NOT NULL`. | `server/companyScope.ts:19-22` |
| S6 | 🟡 | **Restauration de sauvegarde non validée champ par champ.** Seul `companyId` est vérifié. Une archive forgée peut insérer des `saleItems` ou `inventoryItems` pointant vers des produits d'autres entreprises, des `users` avec un rôle arbitraire, etc. | `server/backups.ts:86-104` |
| S7 | 🟡 | `payroll.pay` ne vérifie pas que `beneficiaryId` appartient à l'entreprise. Résultat : paiements fantômes et données incohérentes. | `server/routers/payroll.ts:26` |
| S8 | 🔵 | Aucune clé étrangère (`references()`) dans tout le schéma. L'intégrité repose uniquement sur le code applicatif. | `drizzle/schema.ts` |

### 2.2 Authentification et sessions

| # | Sév. | Constat | Emplacement |
|---|---|---|---|
| A1 | 🟠 | **Sessions irrévocables.** `localLogin` et `adminFallbackLogin` émettent un JWT valable **1 an sans `sessionId`**. La déconnexion ne fait qu'effacer le cookie : un jeton volé reste valide un an, et ni la désactivation de la session ni « révoquer les autres sessions » ne s'y appliquent. | `server/routers.ts:201-208, 296-321` |
| A2 | 🟠 | **Limitation de débit contournable.** L'identité retenue est le premier élément de `X-Forwarded-For`, fourni par le client. Il suffit de changer d'en-tête à chaque requête. Express n'a pas de `trust proxy`. | `server/routers.ts:65-69` |
| A3 | 🟠 | **Déni de service global sur la connexion.** Quand la table en mémoire atteint 10 000 entrées non expirées, **toute nouvelle clé est refusée** : en combinant avec A2, un attaquant bloque toutes les connexions de la plateforme pendant 15 minutes. La limite n'est en outre pas partagée entre instances. | `server/rateLimit.ts:13` |
| A4 | 🟠 | **CSRF.** Le cookie de session est `SameSite=None` hors localhost, et tRPC 11 accepte `multipart/form-data` (requête « simple », sans pré‑vérification CORS). Un site tiers peut donc déclencher les mutations **sans paramètre** : `backups.runNow`, `auth.sessions.revokeOthers`, `onboarding.skip`, `onboarding.complete`, `auth.logout`. | `server/_core/cookies.ts:60`, `server/_core/index.ts:43-49` |
| A5 | 🟡 | **Énumération de comptes.** `auth.emailAvailability` est public et sans limite de débit. `registerCompany` n'a ni limite, ni captcha, ni vérification d'e‑mail : création massive d'entreprises possible. La différence de temps de réponse de `passwordLogin` (scrypt exécuté seulement si le compte existe) permet aussi l'énumération. | `server/routers.ts:237-266, 210-216` |
| A6 | 🟡 | Changer le mot de passe ou le rôle d'un vendeur (`sellers.update`, `users.updateRole`) **ne révoque pas ses sessions**. | `server/routers/commerce.ts:141`, `server/routers.ts:771` |
| A7 | 🟡 | `adminFallbackLogin` reste exposé en production dès qu'une ligne `adminFallbackPasswords` existe pour `OWNER_OPEN_ID`. Aucun écran ne l'utilise : c'est une surface d'attaque inutile. Les journaux écrivent la **longueur du mot de passe saisi et celle du mot de passe configuré**. | `server/routers.ts:296-321` |
| A8 | 🟡 | Unicité des e‑mails vérifiée uniquement en mémoire (`select * from users` puis `find`), sans contrainte en base : risque de doublons en cas de concurrence, et l'opération coûte O(n) sur **tous les utilisateurs de la plateforme** à chaque connexion ou inscription. | `server/routers.ts:214,240,247`, `server/routers/commerce.ts:47-52` |
| A9 | 🔵 | Fonctions de base manquantes : réinitialisation de mot de passe, vérification d'e‑mail, double authentification, verrouillage de compte, politique de mot de passe côté serveur (8 caractères minimum pour les vendeurs). | — |

### 2.3 Sauvegardes et Google Drive

| # | Sév. | Constat | Emplacement |
|---|---|---|---|
| B1 | 🟠 | `backups.runNow` est un `protectedProcedure` : **un simple vendeur peut lancer des sauvegardes sans limite**. Chaque sauvegarde applique la rétention et supprime des archives plus anciennes ; les vendeurs peuvent donc purger l'historique et saturer le stockage. Cette mutation est aussi exposée au CSRF (A4). | `server/routers/backups.ts:38` |
| B2 | 🟡 | La rétention et `removeArchive` suppriment seulement la ligne en base, **pas le fichier stocké**. Les archives, qui contiennent les hachés de mots de passe des vendeurs, restent indéfiniment dans le stockage. | `server/backups.ts:218`, `server/routers/backups.ts:42` |
| B3 | 🟡 | La clé de chiffrement des jetons Drive est dérivée de `JWT_SECRET`, avec un repli en dur `"stockpilot-dev-key"`. Réutiliser une clé pour deux usages est une mauvaise pratique, et faire tourner `JWT_SECRET` casse toutes les connexions Drive. | `server/googleDrive.ts:15` |
| B4 | 🟡 | Le `redirect_uri` OAuth est construit depuis `req.protocol` et l'en‑tête `Host`. Derrière un proxy sans `trust proxy`, le protocole vaut `http` et ne correspond plus à l'URI enregistrée : la connexion Drive échoue. Le `state` OAuth n'expire pas. | `server/googleDriveRoutes.ts:10` |
| B5 | 🟡 | Si la copie Drive échoue **après** la création de l'archive, le bloc `catch` marque la sauvegarde « failed » et insère une archive fantôme en échec, alors que l'archive locale existe bien. | `server/backups.ts:211-227` |
| B6 | 🟡 | Le cookie de session de l'administrateur est transmis au service de tâches planifiées (`x-manus-user-session`). La planification est ainsi liée à un jeton utilisateur, qui peut expirer ou être révoqué. | `server/routers/backups.ts:29-33`, `server/_core/heartbeat.ts` |

### 2.4 Serveur HTTP et client

| # | Sév. | Constat | Emplacement |
|---|---|---|---|
| H1 | 🟡 | Aucun en‑tête de sécurité : pas de CSP, `X-Frame-Options`, `HSTS`, `Referrer-Policy` ni `X-Content-Type-Options` (pas de `helmet`). L'application peut être affichée dans un iframe (clickjacking). | `server/_core/index.ts` |
| H2 | 🟡 | `express.json` et `express.urlencoded` acceptent **50 Mo** sur toutes les routes, y compris les routes publiques : mémoire facile à saturer. | `server/_core/index.ts:37-38` |
| H3 | 🟡 | **XSS dans l'impression des alertes** : `Alerts.tsx` injecte `supplierName`, `name` et `reference` **sans échappement** dans `popup.document.write`. La fenêtre `about:blank` partage l'origine de l'application et peut appeler l'API avec les cookies. Les autres impressions échappent correctement. | `client/src/pages/Alerts.tsx:15` |
| H4 | 🔵 | `receiptUrl`, `companyLogoUrl` et `companySignatureUrl` sont des chaînes libres. Un lien `javascript:` est possible dans `<a href={expense.receiptUrl}>`. Les uploads acceptent du **SVG**, qui peut contenir des scripts. | `client/src/pages/Expenses.tsx:41`, `server/routers/commerce.ts:147-148` |
| H5 | 🔵 | Le script d'analytics `%VITE_ANALYTICS_ENDPOINT%/umami` est laissé tel quel dans le build quand la variable n'est pas définie : requête 404 en production. | `client/index.html`, `dist/public/index.html` |

### 2.5 Dépendances vulnérables (`pnpm audit --prod`)

| Paquet | Version | Problème | Corrigé en |
|---|---|---|---|
| `fast-xml-parser` (via `@aws-sdk/client-s3`) | 5.2.x | 🔴 injection d'entité + 3 DoS | ≥ 5.5.6 |
| `proxy-addr` (via `express`) | 2.0.7 | 🔴 usurpation d'IP | ≥ 2.0.8 |
| `drizzle-orm` | 0.44.6 | 🟠 injection SQL via identifiants | ≥ 0.45.2 |
| `mysql2` | 3.15.1 | 🟠 fuite d'identifiants (déclassement d'authentification) | ≥ 3.22.0 |
| `axios` | 1.19.0 | 🟠 7 avis (SSRF, ReDoS, pollution de prototype) | ≥ 1.20.0 |
| `@trpc/server` | 11.6.0 | 🟠 pollution de prototype | ≥ 11.8.0 |
| `path-to-regexp` (via `express`) | 0.1.12 | 🟠 ReDoS | ≥ 0.1.13 |
| `lodash` / `lodash-es` | ≤ 4.17.23 | 🟠 injection de code (`_.template`) | ≥ 4.18.0 |
| `dompurify` (via `jspdf`, `mermaid`) | 3.4.14 | 🟡 XSS | ≥ 3.4.16 |

`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` et `streamdown` (qui embarque `mermaid` et `katex`) **ne sont pas utilisés** par le code applicatif (voir §4). Les retirer supprime une bonne partie de ces alertes.

---

## 3. Erreurs et bogues fonctionnels

### 3.1 Cohérence des données et concurrence

| # | Sév. | Constat | Emplacement |
|---|---|---|---|
| E1 | 🔴 | **Double encaissement possible.** `checkout` lit la vente (`status = draft`) sans verrou (`SELECT … FOR UPDATE`) ni mise à jour conditionnelle. Deux requêtes simultanées (double clic, synchronisation hors ligne relancée en même temps qu'un encaissement en ligne) décrémentent **deux fois** le stock et créent **deux fois** les commissions et les paiements. | `server/routers/transactions.ts:135-172` |
| E2 | 🟠 | **Mises à jour de stock perdues.** Partout, le stock est lu puis réécrit en valeur absolue (`set({ quantity: resultingQuantity })`) au lieu de `quantity = quantity - ?` avec garde. Deux ventes ou réceptions simultanées sur le même produit écrasent l'une l'autre. | `transactions.ts` (checkout, refund), `routers.ts` (movements.create, purchaseOrders.receive), `inventory.ts` (validate) |
| E3 | 🟠 | **Les remboursements échouent quand une vente contient deux lignes du même produit** : `productRows.length !== items.length` déclenche « Un produit… introuvable ». Le même contrôle bloque `createDraft` et `commerce.sales.create` si un panier contient deux fois le même `productId`. | `server/routers/transactions.ts:78, 108`, `server/routers/commerce.ts:174` |
| E4 | 🟠 | **Tableau de bord faux pour les entreprises SaaS** : les commissions et paiements d'agents ne sont chargés que si `companyId === null`. Pour toutes les autres entreprises, « Paie due » et les dépenses liées aux agents sont faux. | `server/routers.ts:353` |
| E5 | 🟠 | **Numérotation des factures non conforme et sujette aux collisions** : `FAC-AAAAMMJJ-<7 derniers chiffres de Date.now()>`. Elle n'est pas séquentielle, a des trous, et deux documents émis dans la même milliseconde violent la contrainte `UNIQUE` (erreur 500). La réglementation (France et OHADA) exige une numérotation chronologique continue. | `server/routers/transactions.ts:30-33`, `server/routers/commerce.ts:159` |
| E6 | 🟡 | **Fuseau horaire** : « aujourd'hui », « mois en cours » et les tendances sont calculés en UTC (`toISOString().slice`). Une vente faite à 00 h 30 heure locale (UTC+1) est comptée la veille. Aucun réglage de fuseau horaire par entreprise. | `server/routers.ts:359-395`, `commerce.ts:116` |
| E7 | 🟡 | La validation d'inventaire écrase le stock avec la quantité comptée, sans tenir compte des ventes faites entre le comptage et la validation (pas de gel ni d'écart calculé à la date du comptage). Elle ne resynchronise pas non plus les alertes de stock. | `server/routers/inventory.ts:17` |
| E8 | 🟡 | Remboursement : toujours **total**. Il supprime les commissions **même si elles ont déjà été versées**, n'enregistre aucun paiement négatif (la caisse du jour devient fausse) et ne produit pas d'avoir. | `server/routers/transactions.ts:70-98` |
| E9 | 🟡 | `products.update` permet de modifier directement `quantity` **sans mouvement de stock** : la traçabilité est rompue. | `server/routers.ts:489-500` |
| E10 | 🟡 | Commission calculée sur le **total** de la facture dès le premier encaissement partiel. | `server/routers/transactions.ts:156-158` |
| E11 | 🟡 | `products.create` transforme **toute** erreur en « Cette référence produit existe déjà », ce qui masque les vraies erreurs (base indisponible, etc.). Même schéma pour catégories, unités et vendeurs. | `server/routers.ts:485-487` |
| E12 | 🟡 | `transactions.list`, `movements.list` et `audit.list` sont limités aux **100 dernières lignes, sans pagination**. Les factures plus anciennes sont inaccessibles depuis l'interface. | `transactions.ts:55`, `db.ts:91,119` |
| E13 | 🔵 | Bornes manquantes sur certains montants et quantités : `productInput` (prix, quantité), `movements.create.quantity`, `remunerationInput.fixedMonthlyCents`, `payroll.amountCents`, `expenses.budget.amountCents`, `checkout.payments` (pas de `max()` sur la liste). `MAX_CENTS` est importé mais pas appliqué partout. | `server/routers.ts:94-109`, etc. |

### 3.2 Sauvegarde et restauration

| # | Sév. | Constat |
|---|---|---|
| E14 | 🔴 | **Sauvegarde incomplète.** Les tables suivantes ne sont **pas** sauvegardées : `productPriceTiers`, `productCategories`, `productUnits`, `salePayments`, `purchaseOrders`, `purchaseOrderItems`, `expenses`, `expenseBudgets`, `companies`, `backupSettings`, `userDashboardPreferences`, `adminFallbackPasswords`. Après une perte de données, la restauration perd les paliers de prix, l'historique des paiements, les bons de commande et les dépenses. (`server/backups.ts:57-67`) |
| E15 | 🟠 | **Restauration incohérente.** Elle supprime puis réinsère les ventes, produits et utilisateurs, mais laisse intactes les tables non sauvegardées (paiements, bons de commande, paliers…), qui pointent alors vers des ventes ou produits supprimés. Un administrateur créé après la sauvegarde est supprimé et ne peut plus se connecter. |

### 3.3 Client, PWA et hors connexion

| # | Sév. | Constat | Emplacement |
|---|---|---|---|
| E16 | 🟠 | **Le service worker intercepte les navigations vers `/api/...`** : `navigateFallback: "/index.html"` sans `navigateFallbackDenylist`. Dans la PWA installée, le lien « Connecter Google Drive » (`/api/integrations/google-drive/connect`) et le retour OAuth affichent l'application au lieu d'appeler le serveur. Même problème pour les téléchargements `/manus-storage/...`. | `vite.config.ts:177` |
| E17 | 🟡 | Nom de cookie incohérent : `OfflineContext` cherche `manus_session=` alors que l'application utilise `app_session_id` (`COOKIE_NAME`). Le repli `Authorization` ne fonctionne donc jamais pour la synchronisation hors ligne. | `client/src/contexts/OfflineContext.tsx:26` |
| E18 | 🟡 | Hors connexion : une vente encaissée hors ligne puis refusée à la synchronisation (stock insuffisant, prix modifié, client supprimé) reste « failed » **sans moyen de la résoudre**. L'argent a pourtant été encaissé et le ticket provisoire imprimé. Le prix affiché hors ligne peut aussi différer de celui recalculé par le serveur. | `OfflineContext.tsx:151-169` |
| E19 | 🟡 | Le mode hors connexion est désactivé pour les utilisateurs du locataire historique (`companyId = null`). | `OfflineContext.tsx:63-66` |

### 3.4 Tests et CI

| # | Sév. | Constat |
|---|---|---|
| E20 | 🟠 | **La suite de tests échoue aujourd'hui** : `server/auth.sessions.test.ts:42` utilise des dates d'expiration en dur (`2026-09-22`), désormais passées. C'est une « bombe à retardement » : il faut injecter l'horloge (`vi.useFakeTimers` / `vi.setSystemTime`) ou utiliser des dates relatives. **La CI de `main` est donc rouge.** |
| E21 | 🟡 | La CI vérifie la présence de la migration `0041`, alors que la dernière est `0043`. Ce contrôle est obsolète et n'apporte rien. (`.github/workflows/quality.yml:37`) |
| E22 | 🟡 | Les tests d'intégration réels sont ignorés (`backups.download.integration`, `auth.adminFallback`). Presque tous les tests simulent `getDb()`, si bien qu'aucune contrainte SQL, transaction ou concurrence n'est testée. Aucune base MySQL n'est lancée en CI et les migrations n'y sont jamais appliquées. |
| E23 | 🔵 | Pas d'ESLint ni de contrôle `prettier --check` en CI. La CI ne tourne que sur `main` et les PR vers `main`. |
| E24 | 🔵 | `scripts/audit-tenant-scope.mjs` passe au vert malgré S3 et S4 : sa détection ne couvre pas les `select().from(table)` sans `where`, ni les `insert(auditLogs)` sans `companyId`. |

---

## 4. Code mort et éléments inutiles

### 4.1 Endpoints serveur sans appelant côté client

| Endpoint | Remarque |
|---|---|
| `commerce.sales.create` | **Ancien chemin de vente encore actif et dangereux** : crée une facture « payée » sans ligne `salePayments`, sans vérifier les moyens de paiement activés, sans bornes de quantité, avec un audit sans `companyId`. Accessible à tout vendeur. **À supprimer.** |
| `commerce.sales.list` | `innerJoin(customers)` exclut en plus les ventes au comptoir. |
| `commerce.remuneration.list` / `save` | Doublon de la logique de `agents` et `sellers`. |
| `users.list` / `users.updateRole` | Aucun écran. |
| `auth.localLogin`, `auth.adminFallbackLogin` | Surface d'attaque sans interface (voir A1 et A7). |
| `backups.removeArchive` | Aucun écran. |
| `system.notifyOwner` | Héritage du modèle de départ. |

### 4.2 Modules et fichiers jamais importés

- **Serveur (héritage du modèle Manus)** : `server/_core/llm.ts` (454 lignes), `map.ts` (319), `voiceTranscription.ts` (284), `imageGeneration.ts` (160), `dataApi.ts`. Dans `server/_core/sdk.ts`, le flux OAuth Manus (`exchangeCodeForToken`, `getUserInfo`) n'est plus branché (aucune route OAuth enregistrée), de même que `shared/const.ts` → `OAUTH_STATE_COOKIE`, `encodeOAuthState` et `decodeOAuthState`.
- **Client** : `components/AIChatBox.tsx`, `components/Map.tsx`, `lib/offlineCache.ts` (utilisé seulement par son test), et **32 composants `components/ui/*` inutilisés** (accordion, alert, aspect-ratio, breadcrumb, button-group, calendar, carousel, chart, collapsible, command, context-menu, drawer, empty, field, form, hover-card, input-group, input-otp, item, kbd, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, slider, spinner, table, tabs, toggle-group).
- **Commentaires morts** : bloc commenté dans `server/_core/cookies.ts:34-47`.
- **Artefacts versionnés** : `client/dev-dist/` (service worker de développement généré, à ignorer dans git) et `client/public/__manus__/debug-collector.js`, copié dans `dist/public` en production même s'il n'y est pas injecté.

### 4.3 Dépendances inutiles

- Jamais importées : `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `framer-motion`, `date-fns`, `@hookform/resolvers`, `workbox-window`.
- Utilisées seulement par du code mort : `streamdown`, `recharts`, `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `vaul`, `react-hook-form`, les `@radix-ui/*` correspondants, `@types/google.maps`.
- `"add": "^2.0.6"` dans `devDependencies` : ajout accidentel (`pnpm add add`).

---

## 5. Insuffisances (performance, architecture, maintenabilité)

| # | Constat |
|---|---|
| P1 | **Bundle monolithique de 2 Mo** : les 45 pages sont importées statiquement dans `App.tsx`, sans `React.lazy`. L'`index.html` fait 368 Ko (runtime Manus injecté), et `jsxLocPlugin` ajoute en production des attributs de localisation du code source. |
| P2 | **Écritures en base à chaque requête** : `authenticateRequest` fait un `upsertUser` (mise à jour de `lastSignedIn`) et un `touchUserSession` sur **chaque** appel tRPC, soit 2 écritures par requête. |
| P3 | **Requêtes non bornées** : `listProducts` charge **tous les paliers de prix de toutes les entreprises** puis filtre en mémoire (O(produits × paliers)). `dashboard.get` charge toutes les ventes de l'entreprise. Les connexions et inscriptions chargent tous les utilisateurs. `products.detail` fait N+1 requêtes sur les ventes. `agents.update` et `remuneration.save` chargent tous les profils puis font un `find`. |
| P4 | **Limitation de débit en mémoire** : non partagée entre instances et perdue au redémarrage. |
| P5 | `getDb()` crée un pool `drizzle(url)` sans configurer la taille du pool, les délais ni le contrôle de santé. Si la base est indisponible, `getDb()` renvoie `null` et certaines fonctions renvoient silencieusement `[]` (`listProducts`, etc.) au lieu d'une erreur. |
| P6 | Le serveur cherche un **port libre** (3000 à 3019) : en production, cela masque un conflit de port au lieu d'échouer clairement. |
| P7 | **Lisibilité** : des fichiers entiers sont écrits sur des lignes de 1 000 à 3 000 caractères (`routers.ts` fait 66 Ko, `commerce.ts` 43 Ko, `transactions.ts` 24 Ko, les pages client 20 à 32 Ko). Relecture, diff et revue sont très difficiles. `routers.ts` mélange auth, produits, achats, mouvements, tableau de bord, etc. Usage fréquent de `any` (`tx: any`, `table: any`), ce qui annule le typage de Drizzle. |
| P8 | Catégorie et unité sont stockées **en texte dans `products`** (dénormalisées) : un renommage met à jour les produits par correspondance de nom. C'est fragile et coûteux. |
| P9 | Logique dupliquée entre `commerce.sales.create` et `transactions.createDraft/checkout` (validation des agents, alertes de stock, commissions), et entre client et serveur (`priceTiers`, `checkoutRules`, `replenishmentRules`). `escapeHtml` est réécrit trois fois côté client. |
| P10 | Pas de journalisation structurée ni de corrélation des requêtes (seulement `console.*`), pas d'endpoint de santé vérifiant la base, pas de métriques ni de suivi d'erreurs (Sentry ou équivalent). |
| P11 | Pas de gestion propre de l'arrêt du serveur (`SIGTERM`) et pas de validation des variables d'environnement au démarrage (seul `JWT_SECRET` est contrôlé, et seulement à la première signature). |
| P12 | Fort couplage à la plateforme Manus (stockage Forge, heartbeat, `vite-plugin-manus-runtime`, `allowedHosts`) : héberger ailleurs demande de réécrire le stockage et la planification. |

---

## 6. Fonctionnalités manquantes

### Conformité et comptabilité
- Numérotation légale continue des factures, par entreprise et par série (voir E5).
- **Avoirs** et remboursements **partiels** ou retours article par article.
- Factures **verrouillées** après émission (pas de piste d'audit fiable des modifications).
- Export comptable (FEC, journal des ventes, CSV pour expert‑comptable) et clôture de caisse (Z de caisse, fond de caisse, écarts).
- Gestion multi‑taux de TVA par produit (aujourd'hui, un seul taux global).

### Commerce et stock
- Multi‑magasins ou multi‑entrepôts, transferts entre dépôts.
- Lots, numéros de série, dates de péremption.
- Valorisation du stock (CMUP / FIFO) : aujourd'hui, prix d'achat courant uniquement.
- Réservation de stock pour les factures en brouillon et les devis.
- Conversion devis → facture, relances clients et échéancier des créances, plafond de crédit client.
- Gestion des retours fournisseurs.
- Envoi des factures et devis **par e‑mail ou WhatsApp** depuis l'application.

### Comptes et SaaS
- Mot de passe oublié, vérification d'e‑mail, double authentification.
- Rôles plus fins que `admin` / `seller` (gérant, caissier, comptable, lecture seule).
- **Abonnements et facturation SaaS**, limites par plan, console super‑administrateur (prévues dans `plan-configuration-commercialisation-saas.md`, non implémentées).
- Suppression d'entreprise et export RGPD des données personnelles.
- Réglages de fuseau horaire et de langue ; interface uniquement en français.

### Exploitation
- Pagination et recherche côté serveur sur toutes les listes.
- Rapports : ventes par période, par produit, par vendeur ; marge ; rotation des stocks.
- Résolution des conflits de synchronisation hors ligne (voir E18).
- Tests de bout en bout automatisés en CI (les scripts `scripts/verify_*.mjs` sont manuels).

---

## 7. Plan d'action recommandé

### Priorité 0 — avant toute mise en production multi‑entreprise
1. Migration de schéma : remplacer les `UNIQUE` globaux par des `UNIQUE(companyId, …)` (S1) ; ajouter `UNIQUE(companyId)` sur `saleSettings` et `backupSettings`, et un index unique sur `users.email`.
2. Ajouter `companyId` dans **tous** les inserts d'audit (`createAudit`, `audit()`, sauvegardes, dépenses) (S4) et renforcer `audit-tenant-scope.mjs` pour détecter ces cas (E24).
3. Corriger S2 (vérifier `supplierId` et filtrer la lecture dans `products.detail`) et S3 (filtrer `saleSettings` par entreprise).
4. Rendre `checkout` idempotent et sûr en concurrence : `UPDATE sales SET status=… WHERE id=? AND status='draft'` avec contrôle des lignes affectées, ou `SELECT … FOR UPDATE`. Passer toutes les mises à jour de stock en relatif avec garde (`quantity = quantity - ? WHERE quantity >= ?`) (E1, E2).
5. Supprimer `commerce.sales.create`, `auth.localLogin` et `auth.adminFallbackLogin`, ou les rattacher à une session suivie (A1, §4.1).
6. Mettre à jour les dépendances vulnérables (§2.5) et retirer celles qui sont inutilisées.
7. Réparer le test daté (E20) pour remettre la CI au vert.

### Priorité 1 — sécurité et fiabilité
8. `app.set("trust proxy", …)`, limitation de débit basée sur `req.ip` et stockée de façon partagée (Redis ou base), suppression du refus global (A2, A3).
9. CSRF : passer `SameSite` à `Lax` si l'iframe Manus n'est plus nécessaire, ou exiger un en‑tête personnalisé ou `Content-Type: application/json` sur `/api/trpc` (A4).
10. `helmet` (CSP, HSTS, frame-ancestors) et limite de corps réduite (1 Mo par défaut, plus large seulement sur les routes d'upload) (H1, H2).
11. `backups.runNow` réservé à `adminProcedure` avec limitation ; suppression des objets stockés lors de la rétention (B1, B2).
12. Sauvegarde complète de toutes les tables de l'entreprise et restauration validée par schéma Zod table par table (E14, E15, S6).
13. `navigateFallbackDenylist: [/^\/api\//, /^\/manus-storage\//]` dans la configuration PWA (E16) ; corriger le nom du cookie dans `OfflineContext` (E17).
14. Échapper les valeurs dans `Alerts.tsx` (H3) ; refuser le SVG à l'upload et valider les URL (`https:` uniquement) (H4).
15. Révoquer les sessions lors d'un changement de mot de passe ou de rôle, ou d'une désactivation (A6).

### Priorité 2 — qualité et fonctionnalités
16. Numérotation séquentielle des factures par entreprise (table compteur sous transaction) et avoirs (E5, E8).
17. Fuseau horaire par entreprise (E6) et pagination serveur (E12).
18. Découpage du code : un routeur par domaine, formatage Prettier réel, suppression des `any`, `React.lazy` par page (P1, P7).
19. CI : base MySQL de test, application des migrations, tests d'intégration réels, lint (E21 à E23).
20. Feuille de route fonctionnelle (§6) : réinitialisation de mot de passe, rôles fins, abonnements SaaS, export comptable, multi‑dépôts.

---

*Rapport produit par lecture du code et exécution des contrôles locaux (`pnpm check`, `pnpm test`, `pnpm build`, `pnpm audit`). Les numéros de ligne correspondent au commit `81833c5`. Aucune modification de code n'a été faite dans le cadre de cet audit.*
