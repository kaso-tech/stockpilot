# StockPilot Pro — Dossier de continuité

**Date de synthèse :** 23 août 2026  
**Projet Manus :** StockPilot SaaS  
**Chemin de travail :** `/home/ubuntu/stockpilot-pro`  
**Domaine publié :** `https://stockpilot-gpaoheuz.manus.space`  
**Dernier checkpoint fonctionnel :** `ef3f69fd`  
**Dernière archive source fournie :** `/home/ubuntu/stockpilot-pro-current.zip`

## 1. Objectif produit

StockPilot Pro est un SaaS de gestion commerciale pour petites et moyennes entreprises. Il couvre le stock, les produits, fournisseurs, clients, ventes rapides POS, factures, encaissements, dépenses, achats, inventaires, agents, commissions, paie et sauvegardes. L’objectif actuel est de le rendre vendable à plusieurs entreprises avec une isolation stricte des données et un mode hors connexion réellement durable.

> La priorité technique est désormais d’avoir une plateforme **multi-entreprise sûre**, puis un fonctionnement **offline-first** capable de supporter plusieurs jours sans réseau.

## 2. Environnement et exploitation

| Élément | Valeur / règle |
|---|---|
| Stack | React 19, TypeScript, Vite PWA, Express 4, tRPC 11, Drizzle ORM, MySQL/TiDB, Vitest, Tailwind 4 |
| Projet local | `/home/ubuntu/stockpilot-pro` |
| Serveur de développement | Port 3000, démarrage via `pnpm run dev` |
| Vérifications | `pnpm check`, `pnpm test`, `pnpm build` |
| Publication | Auto-publication à chaque checkpoint réussi |
| Base de données | Toute migration : mettre à jour `drizzle/schema.ts`, générer SQL, relire la migration, appliquer avec l’outil SQL dédié |
| Actifs volumineux | Hors du projet ; stockage objet / URL de stockage uniquement |
| Mémoire | Fermer les navigateurs temporaires quand ils ne sont plus utiles ; le sandbox a atteint une forte pression mémoire pendant les builds |

Les secrets sont injectés à l’exécution et ne doivent jamais être affichés, inclus dans une archive ou journalisés. Les variables système existantes comprennent notamment les secrets JWT et les variables de plateforme. Toute nouvelle clé externe doit être ajoutée par le mécanisme de secrets, jamais via un fichier `.env` commité.

## 3. Authentification et inscription

L’ancienne connexion Google/API est désactivée du parcours actif. L’accès normal est une authentification interne **e-mail + mot de passe** ; les mots de passe sont hachés avec scrypt et les sessions passent par cookie sécurisé HttpOnly.

| Parcours | État |
|---|---|
| Connexion administrateur et vendeur | E-mail + mot de passe, opérationnel |
| Inscription entreprise | Route publique `/inscription`, création d’une entreprise et de son premier administrateur |
| Visibilité domaine | Le domaine doit rester configuré **public** dans les paramètres de visibilité Manus ; sinon la plateforme redirige avant le chargement de l’application vers son ancien portail d’authentification |
| E-mail de vérification / mot de passe oublié | **Reporté** : aucun fournisseur d’e-mail transactionnel (Resend ou équivalent) n’est configuré |
| Sessions | « Se souvenir de moi » : session standard 24 h, prolongée 30 jours ; liste et révocation des sessions actives disponibles |

L’inscription contient une vérification en temps réel de disponibilité d’e-mail, un indicateur de force du mot de passe, des boutons afficher/masquer le mot de passe, les liens légaux et un assistant de démarrage. Les pages publiques sont `Conditions d’utilisation` et `Politique de confidentialité`.

## 4. Multi-entreprise : état de l’isolation

Un registre `companies` a été ajouté, et les utilisateurs, paramètres et principales données métier portent désormais un `companyId`. Le filtre commun est défini dans `server/companyScope.ts`. Les routes sensibles doivent toujours employer l’entreprise de `ctx.user.companyId`, jamais un identifiant d’entreprise fourni par le navigateur.

### Renforcements publiés

| Domaine | Protection appliquée |
|---|---|
| Produits, clients, fournisseurs, catégories, unités | Listes, lectures et écritures filtrées par entreprise |
| Factures et ventes | Lecture, encaissement, remboursement, suppression et mouvements associés filtrés |
| POS | Clients, produits, réglages, agents, brouillons, encaissements et alertes filtrés par entreprise |
| Agents, vendeurs et paie | Création, modification, conversion, identifiants vendeur, rémunérations et paiements associés filtrés |
| Inventaires | Comptage, validation, lignes, produits et mouvements filtrés |
| Fichiers d’identité | Logo, signature et cachet stockés sous `company/<companyId>/...` |
| Sauvegardes | Création, contenu, stockage, tâches automatiques, paramètres, rétention, téléchargement, suppression, aperçu et restauration isolés par entreprise |

Les tests couvrent notamment les refus d’accès à une facture et à un encaissement POS hors entreprise. Le dernier audit de sécurité détaillé est dans `tenant-isolation-audit.md`.

### Sauvegardes

La restauration a été refondue pour refuser une archive d’une autre entreprise et traiter les données enfants avant leurs parents. Le contenu de l’archive est filtré par `companyId` et, pour les tables enfant, par les parents sélectionnés dans la même entreprise. Les fichiers importants sont `server/backups.ts`, `server/routers/backups.ts`, `server/scheduledBackups.ts` et leurs tests.

## 5. Mode hors connexion : état réel

Le mode existant possédait déjà une file locale pour les ventes POS et factures, une reprise automatique au retour réseau et une page `/synchronisation` affichant le journal de synchronisation. Le travail récent ajoute le socle durable suivant.

| Élément | État actuel |
|---|---|
| IndexedDB | `dexie@4.4.5` ajoutée |
| Base locale | `client/src/lib/offlineStore.ts` crée `stockpilot-offline-v2` |
| Séparation des données | Clé `company:<companyId>:user:<userId>` pour snapshots et opérations |
| Opérations locales | File IndexedDB, snapshots, compteur de tentatives et dernière erreur |
| Stockage persistant | `navigator.storage.persist()` demandé au démarrage dans `client/src/main.tsx` |
| Journal visuel | Page `/synchronisation` ; échecs, tentatives, reprise manuelle et accès à l’inventaire pour les conflits de stock |
| Idempotence serveur | Les mutations `transactions.createDraft` et `transactions.checkout` reçoivent déjà un `offlineOperationId` |

### Point d’attention important pour la reprise

`client/src/contexts/OfflineContext.tsx` synchronise maintenant la file existante avec IndexedDB, mais conserve encore une compatibilité `localStorage` (`stockpilot_offline_sales_v1` et `stockpilot_sync_log_v1`). Cette coexistence est volontairement transitoire. La prochaine conversation doit finaliser la migration en faisant d’IndexedDB la **source de vérité unique** : lecture asynchrone par périmètre, suppression de la lecture globale `localStorage`, mise à jour transactionnelle de la file et du journal, puis migration sûre des anciennes entrées locales.

En particulier, l’hydratation actuelle ne remplace l’état React que lorsque la file IndexedDB contient des opérations (`if (queued.length)`). Il faut la corriger pour vider l’état au changement de périmètre lorsque la file est vide, sans quoi une donnée résiduelle de `localStorage` peut rester en mémoire jusqu’au prochain cycle. L’interface filtre les éléments par utilisateur, mais le stockage global ne doit pas rester à long terme.

## 6. Interface et design

L’identité principale est le bleu **`#2563EB`**. Les thèmes clair et sombre sont disponibles ; des corrections ciblées ont été apportées aux contrastes de la bannière « Démarrage guidé », des actions rapides, badges, tableaux, modales, popovers et menus déroulants. Toute nouvelle UI doit conserver un contraste lisible dans les deux thèmes.

Les conventions permanentes sont les suivantes : interface professionnelle et responsive, pas de description longue sous les titres de page, boutons et icônes cohérents avec la couleur primaire, formulations d’erreur non révélatrices pour l’authentification.

## 7. Fichiers essentiels

| Fichier / dossier | Rôle |
|---|---|
| `drizzle/schema.ts` | Schéma Drizzle, entreprises et données métier |
| `server/companyScope.ts` | Filtre de périmètre entreprise |
| `server/routers.ts` | Routeur principal, inscription, auth, dashboard |
| `server/routers/commerce.ts` | Clients, agents, vendeurs, réglages, factures, rémunérations |
| `server/routers/transactions.ts` | POS, brouillons, encaissements, remboursements |
| `server/routers/inventory.ts` | Inventaires et mouvements |
| `server/backups.ts` | Création et restauration sélective d’archives |
| `server/routers/backups.ts` | Routes de sauvegarde et restauration |
| `client/src/contexts/OfflineContext.tsx` | File d’opérations, synchronisation et journal hors connexion |
| `client/src/lib/offlineStore.ts` | IndexedDB durable et segmentée |
| `client/src/pages/SyncJournal.tsx` | Journal de synchronisation et revue manuelle du stock |
| `client/src/components/CheckoutSheet.tsx` | Encaissement POS/facture et mise en file hors connexion |
| `tenant-isolation-audit.md` | Audit et décisions multi-entreprises |
| `offline-architecture.md` | Choix et stratégie offline-first |
| `plan-configuration-commercialisation-saas.md` | Feuille de route commerciale SaaS |

## 8. Tests et état de validation

Le dernier état validé avant ce document comprend **155 tests Vitest**, `pnpm check` et `pnpm build` réussis. Les warnings de chunks PWA volumineux et d’options PNPM anciennes sont non bloquants, mais une future optimisation du découpage du bundle est recommandée.

Les commandes à exécuter après chaque lot significatif sont :

```bash
cd /home/ubuntu/stockpilot-pro
pnpm check
pnpm test
pnpm build
```

Après `pnpm add`, redémarrer le serveur de développement. Avant un checkpoint, relire `todo.md` et marquer les éléments effectivement terminés. Chaque checkpoint est automatiquement publié.

## 9. Prochaines actions recommandées

La prochaine conversation doit démarrer par le point critique offline suivant :

1. Finaliser la migration de `OfflineContext` de `localStorage` vers IndexedDB comme source unique par entreprise/utilisateur, y compris la migration des anciennes files et l’état vide au changement de périmètre.
2. Ajouter une représentation explicite des conflits de stock : quantité locale, quantité serveur, décision de correction, conservation d’une preuve dans le journal.
3. Mettre en cache les données métier nécessaires à la navigation sans réseau : produits, clients, agents, réglages de vente et stock de l’entreprise active.
4. Créer une console d’exploitation SaaS séparée des données clients : statut des entreprises, plans, santé de synchronisation, sans accès métier direct.
5. Configurer un fournisseur d’e-mail transactionnel avant d’activer validation d’adresse e-mail et réinitialisation sécurisée de mot de passe.

## 10. Instruction de reprise prête à copier

> Reprendre StockPilot Pro dans `/home/ubuntu/stockpilot-pro`. Lire d’abord `RESUME_CONTINUITE_PROJET.md`, `tenant-isolation-audit.md`, `offline-architecture.md` et `todo.md`. Le dernier checkpoint publié est `ef3f69fd` ; un document de continuité a ensuite été ajouté. Le projet est un SaaS React/tRPC/Drizzle multi-entreprise avec auth interne e-mail/mot de passe. Priorité immédiate : terminer la migration du mode hors connexion de `localStorage` vers IndexedDB par entreprise/utilisateur dans `client/src/contexts/OfflineContext.tsx`, sans régression sur les ventes POS et encaissements idempotents. Exécuter `pnpm check`, `pnpm test` et `pnpm build` après les modifications ; relire `todo.md` avant tout checkpoint. Ne jamais exposer les secrets, hashes ou identifiants sensibles.
