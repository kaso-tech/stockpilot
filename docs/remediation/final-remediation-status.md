# État final de remédiation — StockPilot Pro

**Date :** 24 août 2026  
**Périmètre :** exécution locale des Lots 1 à 9, sans publication distante finale.

## Synthèse

Les lots prévus ont été exécutés séquentiellement dans le dépôt de travail. Chaque lot a été contrôlé avant passage au suivant, documenté dans `docs/remediation/`, suivi dans `todo.md` et enregistré par checkpoint Git local. Les validations finales locales passent : typage TypeScript, suite Vitest, build PWA, audit statique d’isolation et sonde de release.

Le dépôt courant est propre et se trouve neuf commits locaux en avance sur `origin/main`. La publication distante est restée bloquée par l’authentification du dépôt; aucun secret n’a été affiché, stocké dans le projet ou copié dans les artefacts.

## Lots et checkpoints

| Lot | Objet | Checkpoint local | État |
|---|---|---|---|
| 1 | Baseline et harnais de sécurité | `5c20ed5` | Validé localement |
| 2 | Noyau d’isolation multi-entreprise | `0551cd4` | Validé localement |
| 3 | Routes critiques stock/achats | `7e7d9c8` | Validé localement |
| 4 | Sauvegardes, restauration et Drive | `2069767` | Validé localement |
| 5 | Authentification et sessions | `bee49e6` | Validé localement |
| 6 | Offline-first, PWA et impressions | `bbf5677` | Validé localement |
| 7 | Intégrité, schéma et performance | `b543457` | Validé localement |
| 8 | Dépendances, CI et code mort | `970d193` | Validé localement |
| 9 | Validation adversariale et release gates | `91910fd` | Validé localement, go production conditionnel |

## Validation finale

```text
pnpm check                         : réussi
pnpm test                          : réussi — 71 fichiers passés, 2 ignorés; 170 tests passés, 4 ignorés
pnpm build                         : réussi
pnpm verify:release                : réussi — racine 200, dashboard 401, backups 403
node scripts/audit-tenant-scope.mjs : réussi
```

Le domaine public contrôlé reste accessible sans redirection vers Google ou l’authentification Manus et affiche l’authentification interne par e-mail et mot de passe.

## Points restant conditionnels

Le fichier `todo.md` conserve volontairement ouverte la passe transversale d’uniformisation des `any`, erreurs et logs sensibles. Elle n’a pas été maquillée en tâche terminée. L’audit des dépendances conserve des vulnérabilités transitives nécessitant des correctifs amont ou une recette de mises à niveau complémentaires. La migration `drizzle/0041_nosy_goblin_queen.sql` doit être appliquée par le pipeline de base de données après sauvegarde et validation sur un environnement de préproduction.

Le go de production nécessite donc : publication distante des checkpoints, application contrôlée de la migration, tests A/B authentifiés avec deux entreprises, vérification des secrets de production par l’opérateur habilité, et décision formelle sur les vulnérabilités transitives et la passe de qualité restante.

## Procédure de rollback

En cas de régression applicative, revenir au checkpoint local ou distant immédiatement antérieur au lot concerné. Pour une migration déjà appliquée, utiliser la procédure de restauration de base de données validée en préproduction; ne pas supprimer directement les lignes tenant-aware. En cas de problème PWA, invalider le service worker et republier le bundle précédent. En cas d’incident offline, exporter les opérations en attente avant toute purge IndexedDB.
