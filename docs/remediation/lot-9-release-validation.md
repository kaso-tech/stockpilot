# Lot 9 — Validation adversariale, recette et déploiement progressif

**Statut :** Validé localement — déploiement distant en attente de publication du checkpoint  
**Objectif :** vérifier les garde-fous inter-entreprises, les endpoints publics, le mode offline, les impressions et les fonctions métier avant mise en production.

## Vérifications réalisées

Les tests A/B du noyau d’isolation vérifient que deux entreprises utilisant le même identifiant utilisateur logique ne partagent ni scope offline, ni cache query, ni notifications lues. Les routes métier critiques refusent les accès hors entreprise et le scanner `scripts/audit-tenant-scope.mjs` s’exécute sans alerte bloquante.

La sonde `pnpm verify:release` confirme localement que la racine publique répond en HTTP 200, que le dashboard protégé répond sans session par 401 et que la route backups reste protégée. Le domaine publié a été contrôlé visuellement : il affiche l’authentification interne e-mail/mot de passe et ne redirige pas vers Google ou l’authentification Manus.

La migration IndexedDB, le changement de périmètre, le cache query scoped et la sanitation de l’impression produit sont couverts par les tests ciblés. La recette automatisée couvre les contrats POS, factures, agents, sauvegardes, PWA, paiements, stock et import/export sans données réelles.

## Contrôles finaux

```text
pnpm check                   : réussi
pnpm test                    : réussi — 71 fichiers passés, 2 ignorés; 170 tests passés, 4 ignorés
pnpm build                   : réussi
pnpm verify:release          : réussi — racine 200, dashboard 401, backups 403
node scripts/audit-tenant-scope.mjs : réussi
```

## Go / no-go

Le **go local** est accordé pour le bundle produit et la recette technique. Le **go de production est conditionnel** : il exige l’application de `drizzle/0041_nosy_goblin_queen.sql`, une exécution avec les variables de production, une recette A/B authentifiée par deux entreprises distinctes et la résolution ou l’acceptation formelle des vulnérabilités transitives restantes.

Le déploiement distant n’est pas déclaré réussi, car la publication Git distante a déjà été bloquée par l’authentification du dépôt. Les checkpoints locaux restent séparés et réversibles. Pour rollback, revenir au dernier checkpoint publié connu, restaurer la migration précédente si elle a été appliquée selon la procédure de base de données, puis purger les caches PWA et IndexedDB uniquement après export contrôlé des opérations offline en attente.
