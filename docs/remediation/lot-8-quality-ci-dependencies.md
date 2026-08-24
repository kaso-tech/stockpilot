# Lot 8 — Dépendances, CI, code mort et qualité

**Statut :** Validé localement  
**Objectif :** rendre l’installation reproductible, réduire les vulnérabilités prioritaires, supprimer les modules orphelins confirmés et automatiser les contrôles de qualité.

## Corrections réalisées

Les réglages `patchedDependencies` et `overrides` ont été déplacés du bloc `pnpm` obsolète de `package.json` vers `pnpm-workspace.yaml`. L’installation `pnpm install --frozen-lockfile --ignore-scripts` réussit. `axios` a été mis à niveau vers une version corrigée de sa ligne majeure; `nanoid` reste sur la ligne 5 corrigée afin d’éviter une rupture majeure. Des overrides imposent des versions corrigées de `dompurify`, `qs` et `fast-xml-parser`.

Deux modules confirmés orphelins ont été supprimés : l’ancien dialogue Manus non référencé et la page ComponentShowcase non routée. Le module OAuth serveur déjà neutralisé et non monté a également été retiré, sans toucher à Google Drive ni à l’authentification interne.

Un workflow GitHub Actions vérifie l’installation verrouillée, le typage, la suite de tests, l’audit statique d’isolation, la présence de la migration Drizzle et le build de production. Il ne requiert aucun secret applicatif pour les contrôles statiques.

## Contrôles

```text
pnpm install --frozen-lockfile --ignore-scripts : réussi
pnpm check                                  : réussi
pnpm test                                   : réussi — 71 fichiers passés, 2 ignorés; 170 tests passés, 4 ignorés
node scripts/audit-tenant-scope.mjs         : réussi
migration artifact check                    : réussi
pnpm build                                  : réussi
```

## Limite explicitement conservée

Le nettoyage exhaustif des `any`, des logs et des erreurs applicatives reste ouvert dans le registre de remédiation. Il nécessite une passe transversale sur les routeurs et ne doit pas être masqué par un simple formatage automatique. L’audit pnpm conserve des vulnérabilités transitives qui devront être résolues par les mainteneurs amont ou par des montées de version ciblées après recette.
