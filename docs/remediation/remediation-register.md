# Registre de remédiation StockPilot Pro

**Révision de référence :** `32cb362`  
**Statut initial :** tous les constats sont ouverts; le Lot 1 établit le suivi et le harnais.  
**Règle :** un constat ne passe à `Validé` qu’après correction, revue, test de fermeture et validation de non-régression.

| ID | Priorité | Lot principal | Dépendances | Propriétaire | Preuve de fermeture | Statut |
|---|---|---|---|---|---|---|
| C-01 | Critique | L2 | L1, L6, L8 | Backend | Tests d’accès et mutations bons de commande A/B | À faire |
| C-02 | Critique | L2 | L1, L6, L8 | Backend | Tests mouvements et alertes A/B | À faire |
| C-03 | Critique | L2 | L1, L6, L8 | Backend | Propagation catégories/unités limitée au tenant | À faire |
| C-04 | Critique | L2 | L1, L4, L8 | Backend | Changement de rôle adverse refusé | À faire |
| C-05 | Critique | L3 | L1, L6, L8 | Backend/DevOps | Backup, restore et téléchargement isolés | À faire |
| E-01 | Élevée | L3 | L1, L8 | Backend | Audit logs attribués au tenant | À faire |
| E-02 | Élevée | L5 | L1, L8 | Frontend | Scénario compte A/B et offline | À faire |
| E-03 | Élevée | L5 | L4, L8 | Frontend | Purge au logout et changement de compte | À faire |
| E-04 | Élevée | L4 | L8 | Auth/Backend | Aucun chemin OAuth Manus utilisable | À faire |
| E-05 | Élevée | L4 | L8 | Auth/Backend | Session fallback révocable ou route supprimée | À faire |
| E-06 | Élevée | L6 | L1, L8 | Backend | Rejeu paiement multi-moyens idempotent | À faire |
| E-07 | Élevée | L6 | L1, L8 | Backend | Idempotence liée au companyId | À faire |
| E-08 | Élevée | L5 | L8 | Frontend | Payload HTML inerte à l’impression | À faire |
| E-09 | Élevée | L3 | L1, L8 | Backend/DevOps | Google Drive isolé par tenant | À faire |
| E-10 | Élevée | L4 | L8 | Backend/DevOps | Rate limiting et limites body testés | À faire |
| E-11 | Élevée | L3 | L4, L8 | Backend/DevOps | Erreurs cron génériques et codes corrects | À faire |
| E-12 | Élevée | L3 | L6, L8 | Backend | Dry-run et validation parent-enfant | À faire |
| M-01 | Moyenne | L6 | L8 | Backend | Inventaire validé immuable | À faire |
| M-02 | Moyenne | L6 | L8 | Backend | Création inventaire transactionnelle | À faire |
| M-03 | Moyenne | L6 | L2, L8 | Backend | Mutation sans ligne retourne une erreur | À faire |
| M-04 | Moyenne | L6 | L8 | Backend | Agrégation DB et pagination | À faire |
| M-05 | Moyenne | L2 | L6, L8 | Backend | Bons scoppés et paginés | À faire |
| M-06 | Moyenne | L1 | L2, L3, L6, L8 | Backend | Parents/enfants testés inter-tenant | À faire |
| M-07 | Moyenne | L6 | L0, L1, L3, L8 | DBA/Backend | Backfill, FK et uniques composites | À faire |
| M-08 | Moyenne | L4 | L7, L8 | DevOps | Configuration obligatoire et tests dédiés | À faire |
| M-09 | Moyenne | L7 | L8 | DevOps | Lockfile et configuration pnpm fiables | À faire |
| M-10 | Moyenne | L4 | L7, L8 | Auth/Backend | Callback OAuth supprimé ou décision documentée | À faire |
| M-11 | Moyenne | L5 | L8 | Frontend | Préférences isolées au changement de compte | À faire |
| F-01 | Faible | L7 | L8 | Frontend/DevOps | Build sans placeholders analytics | À faire |
| F-02 | Faible | L7 | L1, L2, L3 | Architecture | Routeurs séparés et revue facilitée | À faire |
| F-03 | Faible | L7 | L8 | Architecture | Chaque candidat mort confirmé/documenté | À faire |

## Règles de mise à jour

Chaque lot doit ajouter son checkpoint, ses commandes de validation, ses tests et les fichiers modifiés. Les lignes ne doivent être marquées `Validé` qu’après passage de `pnpm check`, `pnpm test`, `pnpm build`, revue des différences et exécution des tests de fermeture du lot. Un échec est conservé comme `Bloqué` avec sa cause et son action de déblocage.
