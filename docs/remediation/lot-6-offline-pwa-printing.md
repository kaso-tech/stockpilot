# Lot 6 — Client offline-first, PWA et impressions

**Statut :** Validé localement  
**Objectif :** éliminer les persistances métier globales du navigateur, imposer le périmètre entreprise/utilisateur au mode hors connexion et sécuriser les sorties HTML d’impression.

## Corrections réalisées

Le runtime offline exige désormais un `companyId` positif et un `userId` positif. `OfflineContext` refuse les enregistrements IndexedDB qui ne correspondent pas exactement au périmètre actif; les données legacy ne peuvent entrer que par la migration contrôlée qui ajoute l’entreprise active. Les opérations et journaux restent persistés dans IndexedDB et sont vidés côté mémoire lors d’un changement d’utilisateur ou d’entreprise.

Le magasin IndexedDB version 3 dispose de tables séparées pour les préférences et le cache query. Les préférences de devise, couleur et format ne lisent ni n’écrivent plus `localStorage`. Le cache query est scoped et n’est plus restauré globalement au démarrage avant authentification. Les préférences dashboard globales inutilisées ont été supprimées. Les notifications lues utilisent une clé combinant entreprise et utilisateur.

Le hook d’authentification ne conserve plus d’identité dans `localStorage` et ne lance plus de navigation OAuth. Les sorties HTML d’impression du bon de commande produit échappent les champs contrôlables avant `document.write`.

## Contrôles

```text
pnpm check  : réussi
pnpm test   : réussi — 70 fichiers passés, 2 ignorés; 167 tests passés, 4 ignorés
pnpm build  : réussi — bundle PWA et service worker générés
```

Les tests ciblés IndexedDB, migration legacy, cache scoped, notifications et normalisation dashboard passent. Le build produit le manifest et le service worker attendus.

## Risque résiduel transféré

Le thème visuel reste persisté dans une clé locale générique, car il ne contient pas de données métier. Le canal `sessionStorage` utilisé pour transmettre le jeton de session interne dans certains WebView reste technique et ne sert pas de source de vérité offline. La sanitation des impressions qui copient un DOM déjà rendu devra être couverte par un test navigateur dans le Lot 9.
