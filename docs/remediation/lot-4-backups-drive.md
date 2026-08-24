# Lot 4 — Sauvegardes, restauration, audit et Google Drive

**Statut :** Validé localement  
**Objectif :** empêcher les sauvegardes/restaurations globales, les sélections Google Drive hors tenant et la fuite d’erreurs internes du callback planifié.

## Corrections réalisées

Les services de sauvegarde exigent désormais un `companyId` numérique explicite. Les archives sont écrites dans une clé de stockage tenant-aware, listées et téléchargées avec un scope d’entreprise, et les traitements planifiés refusent toute configuration legacy sans entreprise.

Le payload de restauration est validé avant toute suppression. La validation impose le schéma StockPilot version 1, un `companyId` positif, des tables connues, des lignes objet et la cohérence des relations vendeur/vente/inventaire. La transaction supprime uniquement les parents du tenant courant et leurs enfants identifiés, puis réinsère les lignes validées. L’audit de restauration porte le `companyId` courant.

La synchronisation Google Drive charge désormais la configuration et l’archive dans le même tenant, rafraîchit les tokens dans ce périmètre, et met à jour l’archive uniquement si son `companyId` correspond. Les routes connect/callback authentifient un administrateur, récupèrent la configuration de sa société, lient le state OAuth à cette configuration et ne renvoient plus les messages d’erreur internes.

Le callback `/api/scheduled/backup` sépare les erreurs d’authentification, refuse les tâches non cron, renvoie un statut non réessayable pour un périmètre invalide et expose seulement un code générique accompagné d’un identifiant de corrélation. Les détails restent dans les journaux serveur.

## Contrôles

```text
pnpm check  : réussi
pnpm test   : réussi — 69 fichiers passés, 2 ignorés; 163 tests passés, 4 ignorés
pnpm build  : réussi
```

Les tests dédiés aux payloads, à la confirmation, aux relations parent-enfant, à la restauration intégrée et au callback planifié passent. Les tests d’intégration réels Google Drive/stockage restent dépendants de leurs fournisseurs et doivent être exécutés dans l’environnement staging configuré.

## Risque résiduel transféré

La compatibilité des archives historiques globales est volontairement refusée; une procédure de migration contrôlée devra être fournie si des archives legacy doivent être conservées. Les audits historiques sans companyId et les contraintes physiques de base restent traités dans les Lots 5 et 7.
