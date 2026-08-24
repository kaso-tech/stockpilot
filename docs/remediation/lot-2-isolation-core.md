# Lot 2 — Noyau d’isolation multi-entreprise

**Statut :** Validé localement  
**Base :** checkpoint Lot 1 `5c20ed5`  
**Objectif :** rendre l’absence de périmètre explicite détectable et fournir des helpers réutilisables avant la correction des routes métier.

## Réalisé

`server/companyScope.ts` expose désormais un type `CompanyId`, refuse immédiatement un `companyId` indéfini et fournit `scopedResourceId` pour composer un accès par identifiant et entreprise. `belongsToCompany` permet de vérifier une ligne déjà chargée avant de la transmettre à un service ou à une relation enfant.

Le scanner `scripts/audit-tenant-scope.mjs` produit un rapport JSON heuristique des requêtes par identifiant qui ne contiennent pas de `companyScope`. Il signale encore les routes métier historiques qui seront corrigées dans le Lot 3; il sert de garde de détection, pas de preuve autonome d’isolation.

Les fixtures `server/test/tenantFixtures.ts` et le test `server/test/tenantIsolationHarness.test.ts` fournissent deux entreprises synthétiques, quatre utilisateurs synthétiques, des contextes tRPC et des identifiants croisés réutilisables. Les fixtures ne contiennent aucun secret, hash ou token réel.

Les suites d’authentification et de stockage dépendant d’infrastructure sont maintenant explicites : les valeurs locales de test sont synthétiques et les intégrations sont ignorées uniquement lorsque `DATABASE_URL` ou Forge Storage est absent; elles restent actives dès que leurs prérequis sont présents.

## Validation

```text
pnpm check  : réussi
pnpm test   : réussi — 69 fichiers passés, 2 ignorés; 160 tests passés, 4 ignorés
pnpm build  : réussi
```

Le scanner de scope a été exécuté et signale les accès historiques attendus dans les routes produits/achats/catégories/unités. Ces alertes restent ouvertes et sont la cible du Lot 3.

## Passage au Lot 3

Le Lot 3 doit utiliser `scopedResourceId` ou un helper métier équivalent dans chaque procédure listée par le scanner, puis ajouter les tests A/B qui prouvent l’absence de lecture et de mutation inter-entreprise.
