# Lot 3 — Routes métier critiques et opérations stock/achats

**Statut :** Validé localement  
**Base :** checkpoint Lot 2 `0551cd4`  
**Objectif :** empêcher les lectures et mutations inter-entreprises sur les bons de commande, les produits, les fournisseurs, les catégories, les unités, les mouvements, les alertes et les rôles.

## Corrections réalisées

Les bons de commande sont désormais listés avec un filtre `companyScope`, la sélection fournisseur est scoppée, le catalogue produit utilisé à la création est scoppé et la création écrit le `companyId` authentifié. Les détails, transitions, suppressions, annulations et réceptions vérifient le parent. Les lignes enfants ne sont lues ou supprimées qu’à partir d’identifiants de bons déjà validés dans le tenant. Les réceptions mettent à jour le produit par identifiant et scope, puis créent le mouvement avec le `companyId` courant.

Les vérifications d’usage d’un fournisseur, les catégories et les unités filtrent maintenant les produits et les bons du tenant courant. Les renommages ne propagent plus leur valeur textuelle à d’autres entreprises. La modification d’un produit vérifie l’existence scoped avant de remplacer ses paliers de prix. La suppression d’un produit retourne `NOT_FOUND` lorsqu’il n’existe pas dans le tenant courant.

Les mouvements vérifient le fournisseur éventuel, les réglages vendeur et le produit avec `companyScope`; la mise à jour du stock, le mouvement, l’audit et la synchronisation d’alerte restent dans le même périmètre. `users.updateRole` charge et modifie désormais uniquement une cible de la société de l’administrateur.

## Contrôles

Le scanner `scripts/audit-tenant-scope.mjs` a été exécuté avant et après le lot. Les accès critiques précédemment détectés sur `purchaseOrders`, `products`, `productCategories` et `productUnits` ont été réduits; les alertes restantes correspondent à deux motifs historiques nécessitant une revue ultérieure, et ne doivent pas être interprétées comme une preuve d’absence de défaut.

```text
pnpm check  : réussi
pnpm test   : réussi — 69 fichiers passés, 2 ignorés; 160 tests passés, 4 ignorés
pnpm build  : réussi
```

Les tests ciblés produits, bons de commande, ventes, inventaires et détails métier passent. Les fixtures du Lot 1 ont été complétées par un `companyId` explicite afin que le durcissement ne transforme jamais un contexte de test incomplet en requête globale.

## Risque résiduel transféré

Le lot n’a pas encore rendu `companyId` obligatoire au niveau de la base, n’a pas migré les sauvegardes legacy et n’a pas attribué systématiquement `companyId` aux audits historiques. Ces sujets relèvent des Lots 4 et 7. Les tests A/B avec deux bases réellement persistées devront être exécutés dès que l’environnement staging sera disponible.
