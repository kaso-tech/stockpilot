# Lot 5 — Authentification, sessions et exposition réseau

**Statut :** Validé localement  
**Objectif :** maintenir exclusivement l’authentification interne e-mail/mot de passe et réduire les risques de fallback, de session persistante et d’abus des endpoints publics.

## Corrections réalisées

Le client ne déclenche plus de portail OAuth et ne persiste plus l’identité courante dans `localStorage`. Le hook `useAuth` s’appuie uniquement sur `auth.me` et la session HTTP interne. Le callback OAuth historique côté serveur est neutralisé et n’est pas monté par le serveur. Les appels OAuth conservés dans le SDK ne servent plus à synchroniser un utilisateur applicatif; ils restent limités au canal cron technique nécessaire au mécanisme planifié.

Le login administrateur exige désormais une empreinte de mot de passe stockée en base. Le fallback textuel est autorisé uniquement dans les tests synthétiques ou un environnement de développement explicitement configuré; il est désactivé en production. Le seed du fallback ne s’exécute plus en production. Les erreurs de connexion sont uniformisées afin de ne pas révéler le rôle ou l’existence d’un compte.

Un limiteur de débit mémoire borné protège les tentatives par adresse et par compte. Les révocations de sessions vérifient l’utilisateur propriétaire dans la lecture et l’écriture. Le SDK refuse en production un secret JWT absent ou inférieur à la longueur minimale attendue. Les cookies restent `HttpOnly`, `Secure` et `SameSite=None` derrière HTTPS public, avec le comportement local préservé.

## Contrôles

```text
pnpm check  : réussi
pnpm test   : réussi — 70 fichiers passés, 2 ignorés; 165 tests passés, 4 ignorés
pnpm build  : réussi
```

Les tests ciblés de password login, fallback, sessions, cookies, login vendeur, rate limiting et callback d’authentification passent. Le contrôle statique ne retrouve plus de navigation client vers le callback OAuth ni de montage actif du callback externe.

## Risque résiduel transféré

Le limiteur de débit mémoire n’est pas partagé entre plusieurs instances de serveur; une protection distribuée devra être ajoutée dans le Lot 8 ou l’infrastructure de production si le déploiement devient multi-instance. Les méthodes OAuth techniques encore présentes dans le SDK devront être supprimées avec leur code mort lorsque la gestion cron ne dépendra plus de ce SDK.
