# StockPilot Pro — Dossier de continuité

**Date de synthèse :** 24 août 2026  
**Projet Manus :** StockPilot SaaS  
**Chemin de travail :** `/home/ubuntu/stockpilot-pro`  
**Domaine publié :** `https://stockpilot-gpaoheuz.manus.space`  
**Dernier checkpoint fonctionnel avant la synchronisation GitHub actuelle :** `20eefcc1`  
**Dernière archive source fournie :** `/home/ubuntu/stockpilot-pro-current.zip`

## 1. Objectif produit

StockPilot Pro est un SaaS de gestion commerciale pour petites et moyennes entreprises. Il couvre le stock, les produits, fournisseurs, clients, ventes rapides POS, factures, encaissements, dépenses, achats, inventaires, agents, commissions, paie et sauvegardes. L’objectif actuel est de le rendre vendable à plusieurs entreprises avec une isolation stricte des données et un mode hors connexion réellement durable.

> La priorité technique est désormais d’avoir une plateforme **multi-entreprise sûre**, puis un fonctionnement **offline-first** capable de supporter plusieurs jours sans réseau.

## Mise à jour — multi-entrepôts et transferts

Le lot multi-entrepôts est désormais implémenté. Les tables `warehouses`, `warehouseStocks`, `stockTransfers` et `stockTransferItems` portent le périmètre entreprise et la migration `0048_outgoing_rage.sql` a été appliquée sans suppression de données. Un entrepôt principal est créé pour chaque entreprise existante, pour les comptes historiques legacy et lors de chaque nouvelle inscription; le stock historique a été initialisé dans ce dépôt sans double comptage.

Les transferts disposent des statuts brouillon, en transit, réceptionné et annulé. L’expédition vérifie atomiquement le stock source; réception et annulation sont idempotentes, et les opérations sont consignées dans l’audit. Les accès **Entrepôts** et **Transferts** sont présents dans la navigation administrateur. Les ventes rapides, factures, devis, mouvements manuels, inventaires, réceptions fournisseurs et chemin de vente hérité utilisent le dépôt sélectionné ou le dépôt principal. Les opérations POS et facture hors connexion conservent aussi `warehouseId`, avec réservations locales segmentées par entrepôt.

Les validations du lot sont : `pnpm check`, **206 tests Vitest** et `pnpm build` réussis. La vérification visuelle a confirmé le dépôt principal et les sélecteurs d’entrepôt dans la vente rapide et les documents commerciaux. Le warning PWA relatif au bundle principal d’environ 2,8 Mo reste non bloquant.

## Incident résolu sous réserve de reconnexion — données non visibles

Après le lot multi-entrepôts, un administrateur historique s’est retrouvé dans le périmètre legacy tandis que les données métier restaient intégralement dans l’entreprise `companyId = 1`. L’inventaire non destructif a confirmé la conservation des produits, clients, fournisseurs, ventes, mouvements, achats, inventaires, dépenses et stocks localisés. Après confirmation explicite de l’utilisateur, le compte administrateur legacy récemment connecté a été rattaché transactionnellement à l’entreprise concernée, avec une trace d’audit. Les données n’ont été ni supprimées, ni déplacées, ni dupliquées. Une reconnexion est nécessaire pour renouveler la session et recharger le nouveau périmètre.

Le compte vendeur actif, encore dans le périmètre legacy après le rétablissement administrateur, a ensuite été rattaché à la même entreprise après signalement de l’utilisateur. Son rôle vendeur et son statut actif ont été conservés; le rattachement est également audité. Une reconnexion du vendeur est nécessaire pour actualiser sa session.

## Ajustements d’interface récents

La connexion ne présente plus qu’une seule action d’inscription : celle située sous le bouton de connexion. Les agents appliqués automatiquement par les réglages POS sont désormais cachés complètement dans l’écran d’encaissement, tout en restant appliqués côté serveur. Les filtres et exports CSV des factures, devis et tickets proposent maintenant les vendeurs, agents commerciaux et caissiers, avec des clés de filtre distinctes pour éviter toute collision d’identifiants.

## Suppression en masse sécurisée

La page « Import & export » comporte un espace réservé aux administrateurs permettant de sélectionner en masse des produits, fournisseurs ou clients. L’aperçu vérifie les dépendances avant la suppression : les produits avec mouvements, les fournisseurs liés à des produits ou bons de commande, et les clients liés à des documents commerciaux restent protégés. Une suppression ne peut être exécutée que si toute la sélection est admissible, après saisie exacte de `SUPPRIMER`. Toute opération utilise le périmètre `companyId`, est réévaluée dans une transaction et crée une entrée de journal d’audit.

## Entrepôt actif de l’administrateur

Un sélecteur global d’entrepôt est disponible dans l’en-tête pour les administrateurs. Le choix est persistant par couple utilisateur/entreprise dans `userWarehousePreferences`, validé contre les entrepôts actifs du périmètre courant et tracé dans l’audit. Les produits, alertes de stock, mouvements et inventaires affichent désormais les quantités et historiques de l’entrepôt actif. La création d’un produit depuis cette gestion affecte son stock initial à ce même entrepôt. Les flux POS et facture conservent leur propre sélection opérationnelle afin de ne pas modifier les ventes en cours.

## Vue d’exploitation complète par entrepôt

Le changement de dépôt administratif pilote désormais les données opérationnelles : tableau de bord, chiffre d’affaires, marges, stock, alertes, tendances, factures, devis, tickets, mouvements, inventaires, produits, dépenses, paiements agents et commissions. Les pages POS et création de documents commerciaux synchronisent aussi leur entrepôt opérationnel avec ce choix, en vidant le panier local lors d’un basculement afin d’éviter un mélange de stocks. Les budgets mensuels, dépenses et paiements agents disposent maintenant d’un `warehouseId`; les migrations `0050` et `0051` ont rattaché les écritures historiques au dépôt principal. Les entités de référence de l’entreprise — clients, fournisseurs, catalogue maître, coordonnées, paramètres et profils agents — restent volontairement partagées, tandis que leurs historiques et performances suivent l’entrepôt actif.

## Pilotage consolidé et accès vendeur aux dépôts

La migration `0052` crée `sellerWarehouseAssignments`, avec unicité par entreprise, vendeur et entrepôt. Les vendeurs historiques sont rattachés aux dépôts actifs de leur entreprise pour préserver leur capacité opérationnelle; les nouveaux vendeurs et agents convertis en vendeurs reçoivent le dépôt principal par défaut, puis l’administrateur peut ajuster la liste depuis « Agents & paie ». La création et la consultation de documents, de produits et de stocks vérifient désormais cette affectation côté serveur, y compris lorsque le dépôt par défaut aurait été résolu implicitement.

La route « Pilotage consolidé » compare les entrepôts actifs d’une entreprise sur une période mensuelle : chiffre d’affaires encaissé, marge, dépenses incluant la paie, résultat opérationnel, nombre de documents, panier moyen, valeur de stock, alertes de seuil et budget. Elle reste réservée aux administrateurs; chaque ligne permet de basculer vers la vue opérationnelle du dépôt sélectionné.

## Correctif de la fenêtre d’affectation vendeur

La fenêtre « Gérer les dépôts » des vendeurs utilise désormais une valeur de repli stable lorsque la requête d’affectations est en attente. L’état des cases à cocher n’est synchronisé qu’à la réception des données ou à la fermeture de la fenêtre, ce qui évite une boucle de rendu React. La normalisation dédoublonne aussi les identifiants d’entrepôt avant affichage; aucune affectation persistée n’est modifiée par ce correctif.

## Recherche de vendeur dans les affectations

La zone « Affectations des vendeurs » comporte une recherche instantanée par nom, identifiant interne ou e-mail. La recherche ne modifie aucune affectation et affiche un état vide explicite lorsqu’aucun vendeur actif ne correspond. La logique de recherche est couverte par les tests unitaires des utilitaires d’affectation.

## Portée multi-entrepôts des agents commerciaux

La migration `0053` ajoute le mode `warehouseScope` aux agents et la table `salesAgentWarehouseAssignments`. Les agents commerciaux peuvent être configurés depuis « Agents & paie » en trois modes : `all` pour coordonner des ventes dans tous les dépôts, `selected` pour n’être sélectionnables que dans les entrepôts attribués, et `attribution_only` pour rester attachables commercialement aux ventes de tous les dépôts sans accès opérationnel aux stocks. La validation est effectuée côté serveur lors de la création de brouillons, de l’encaissement et du chemin de vente hérité. Les sélecteurs POS et facture/devis ne présentent que les agents admissibles au dépôt opérationnel choisi; un agent par défaut devenu non admissible force une nouvelle sélection plutôt que de contourner la portée.

## Tableau de commissions par agent et entrepôt

La migration `0054` ajoute `paymentKind` à `agentPayments`, avec les valeurs `commission`, `salary` et `mixed`; les écritures existantes restent `mixed` pour préserver leur signification historique. La section « Commissions par agent et entrepôt » d’« Agents & rémunérations » filtre la période, l’entrepôt et le bénéficiaire. Elle compare les commissions générées à partir des ventes, les paiements explicitement qualifiés de commission et le solde de commission restant. Les versements mixtes et salariaux restent visibles séparément et ne diminuent jamais artificiellement le solde de commission. Les nouveaux paiements peuvent être catégorisés depuis la fiche de l’agent.

## Exploitation multi-entrepôts : rôles, transferts et alertes locales

La migration `0055` ajoute un rôle local à chaque affectation opérationnelle (`manager`, `cashier`, `seller`), les seuils `warehouseReorderThresholds` et les alertes `warehouseStockAlerts` par produit et entrepôt. Les affectations existantes restent au rôle vendeur pour conserver les accès actuels. Le responsable peut suivre le stock, encaisser, gérer les transferts et régler les seuils; le caissier peut vendre et encaisser; le vendeur peut préparer les ventes. Les contrôles sont centralisés côté serveur et les modifications sont journalisées.

Les transferts disposent maintenant d’un cycle brouillon → en transit → réceptionné, avec annulation traçable et retour automatique du stock source pour les transferts annulés en transit. Les responsables concernés peuvent traiter les transferts de leurs dépôts; les autres utilisateurs ne voient que les mouvements portant sur leurs entrepôts attribués. L’écran Entrepôts permet d’attribuer le rôle local de chaque utilisateur opérationnel et de saisir les seuils de chaque produit. Toute entrée ou sortie de stock synchronise l’alerte locale, et la page Alertes ainsi que le bon de commande de réapprovisionnement utilisent exclusivement le dépôt actif.

## Notifications ciblées de rupture

Le centre de notifications de l’application reçoit désormais les alertes stock locales persistées dans `warehouseStockAlerts`. Un administrateur voit les alertes de tous les dépôts, tandis qu’un utilisateur opérationnel ne reçoit que celles des entrepôts où son rôle local est `manager`. Chaque notification porte l’état actif ou résolu, le produit, la quantité observée, le seuil et le dépôt concerné. L’identifiant contient l’horodatage de mise à jour : une alerte déjà lue n’est pas répétée tant qu’elle reste active, mais une nouvelle rupture après résolution est signalée à nouveau. Les alertes résolues restent visibles sept jours pour confirmer la remise à niveau.

## Urgence et accusé de réception des ruptures

La migration `0056` complète les alertes locales avec les champs de couverture estimée, urgence et accusé de réception. La couverture est calculée à partir des ventes encaissées ou partielles des trente derniers jours dans le dépôt concerné. Une rupture est `critical` si le stock est nul ou si la couverture est inférieure ou égale à un jour, `high` jusqu’à trois jours, puis `medium`. Un responsable d’entrepôt ou un administrateur peut accuser réception de l’alerte; cette action est tracée. L’envoi e-mail optionnel reste volontairement en attente d’une configuration de fournisseur transactionnel, conformément au choix de l’utilisateur.

## Pages d’information publiques

Les routes publiques `/aide`, `/conditions-utilisation`, `/politique-securite` et `/contactez-nous` sont disponibles sans connexion. Les liens Aide, Politique de sécurité, Contactez-nous et Conditions d’utilisation sont aussi disponibles dans le menu utilisateur de l’application. Les contenus légaux constituent des modèles à adapter à l’offre commerciale et à la juridiction applicables avant mise en service.

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
| `server/routers/printingSettings.ts` | Réglages multi-entreprises des tickets et de l’imprimante par défaut |
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

Le dernier état validé comprend **190 tests Vitest**, `pnpm check` et `pnpm build` réussis. La synchronisation GitHub récente ajoute une page dédiée « Impression et imprimante », des préférences de ticket et d’imprimante isolées par entreprise, une trace d’audit et la migration Drizzle `0043_loving_boom_boom.sql`, déjà appliquée. Les warnings de chunks PWA volumineux sont non bloquants, mais une future optimisation du découpage du bundle est recommandée.

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

> Reprendre StockPilot Pro dans `/home/ubuntu/stockpilot-pro`. Lire d’abord `RESUME_CONTINUITE_PROJET.md`, `tenant-isolation-audit.md`, `offline-architecture.md` et `todo.md`. Le projet est un SaaS React/tRPC/Drizzle multi-entreprise avec auth interne e-mail/mot de passe. La mise à jour GitHub `81833c5` a été intégrée fonctionnellement avec les réglages d’impression multi-entreprises et la migration `0043_loving_boom_boom.sql`. Priorité immédiate : terminer la migration du mode hors connexion de `localStorage` vers IndexedDB par entreprise/utilisateur dans `client/src/contexts/OfflineContext.tsx`, sans régression sur les ventes POS et encaissements idempotents. Exécuter `pnpm check`, `pnpm test` et `pnpm build` après les modifications ; relire `todo.md` avant tout checkpoint. Ne jamais exposer les secrets, hashes ou identifiants sensibles.
