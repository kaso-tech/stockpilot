# Lot 1 — Baseline et harnais de sécurité

**Statut :** Validé  
**Révision de départ :** `32cb362`  
**Périmètre :** préparer la remédiation sans modifier les comportements métier.

## Objectif

Ce lot établit une base reproductible pour corriger les 31 constats d’audit. Il ne ferme pas encore les vulnérabilités métier; il prépare le registre, les fixtures et le harnais qui permettront de prouver les corrections des lots suivants.

## Règles de changement

Chaque lot part d’un checkpoint propre et doit conserver les fonctionnalités POS, factures, impressions, agents, paie, sauvegardes et PWA. Toute lecture ou mutation métier ajoutée pendant la remédiation doit dériver le périmètre de `ctx.user.companyId`; un `companyId` fourni par le client ne constitue jamais une autorité.

Les tests utilisent uniquement les tenants synthétiques `101` et `202`, les utilisateurs `1001`, `1002`, `2001` et `2002`, ainsi que des identifiants de ressources réservés au harnais. Aucun secret réel, hash, token, URL privée ou export de production ne doit être ajouté aux fixtures ou aux journaux.

## Commandes de référence

```bash
pnpm check
pnpm test
pnpm build
```

Contrôles complémentaires avant chaque checkpoint :

```bash
pnpm audit --prod
pnpm exec prettier --check <fichiers-modifiés>
git diff --check
git status --short
```

Les tests qui nécessitent une base ou un stockage doivent être exécutés avec une configuration de test isolée. Le fichier `server/test/setup.ts` fournit uniquement des valeurs synthétiques pour les tests locaux; il ne remplace aucune configuration de production. Les suites `auth.adminFallback.test.ts` et `backups.download.integration.test.ts` restent actives dès que `DATABASE_URL` ou les variables Forge sont disponibles, et sont explicitement marquées comme ignorées sinon. Un test d’intégration ne doit pas être considéré comme réussi si la dépendance externe est absente; il doit signaler clairement son prérequis.

## Harnais disponible

Le fichier `server/test/tenantFixtures.ts` fournit deux entreprises déterministes, un administrateur et un vendeur par entreprise, des contextes tRPC compatibles et des identifiants croisés réservés. Le fichier `server/test/tenantIsolationHarness.test.ts` vérifie que les identités et les périmètres ne se chevauchent pas. Les lots 2 à 9 doivent réutiliser ces fixtures plutôt que de recréer des utilisateurs locaux dans chaque test.

La matrice complète se trouve dans `docs/remediation/corrections-matrice.csv`. Chaque entrée possède un identifiant stable, une priorité, un lot principal, ses dépendances, une preuve de fermeture et un gate.

## Critères de go/no-go

Le Lot 1 est validé : le registre couvre exactement C-01 à F-03, les fixtures sont déterministes, le harnais passe sans base réelle, les commandes obligatoires réussissent et le dépôt ne contient aucun changement non prévu. Tout échec TypeScript, test ou build bloque le passage au Lot 2; une dépendance externe absente doit être enregistrée comme blocage explicite.

## Rollback

Le rollback du Lot 1 consiste à revenir au checkpoint `32cb362`, puis à supprimer uniquement les artefacts `docs/remediation/` et `server/test/` ajoutés par ce lot. Aucun schéma, aucune donnée et aucun secret n’est modifié par ce rollback.

## Passage au Lot 2

Après validation et publication du checkpoint du Lot 1, le Lot 2 peut commencer. Il devra d’abord réutiliser le harnais pour centraliser les assertions d’isolation serveur avant de modifier les routes critiques.
