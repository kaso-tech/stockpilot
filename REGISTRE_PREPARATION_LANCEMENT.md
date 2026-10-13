# Registre de préparation au lancement — StockPilot Pro

> **Statut au 29 août 2026 : pilote commercial encadré uniquement.** Ce registre consolide les contrôles techniques disponibles et les décisions restant à confirmer. Il ne constitue ni une certification de conformité, ni un avis juridique, fiscal, comptable ou de sécurité indépendant.

## 1. Usage du registre

Ce document est la référence opérationnelle avant toute ouverture commerciale large. Le propriétaire du service le relit à chaque évolution sensible, à chaque incident et avant toute activation de paiement. Les preuves techniques citées ici sont vérifiables dans le dépôt ; les validations externes restent explicitement ouvertes tant qu’elles ne sont pas documentées par les responsables compétents.

| Domaine | État actuel | Preuve ou action attendue | Décision de passage |
|---|---|---|---|
| Dépendances | Contrôle technique validé | Audit des dépendances de production dans la recette de release. [1] | Maintenir l’audit à chaque publication. |
| Isolation et accès | Contrôles applicatifs validés | Périmètres entreprise, entrepôt, fichier et session durcis. [2] [3] | Revue indépendante ciblée avant ouverture large. |
| Continuité | Partiellement validée | Sauvegarde 6 h, 30 archives, RPO 6 h, RTO cible 8 h. [4] | Exécuter et consigner une restauration témoin sur recette. |
| Offline | Encadré | Cache séparé entreprise-utilisateur-entrepôt ; stock local estimé. [5] | Ne pas promettre un usage autonome multi-jours sans test terrain, quota et chiffrement local. |
| Qualité | Contrôle technique validé | Tests, build, audit, artefacts de migrations et routes sensibles contrôlés. [1] | Conserver une recette manuelle par version majeure. |
| Paiement SaaS | En pause SANDBOX | Le verrou PayIn est fermé : aucun checkout, paiement ou abonnement ne peut être créé. [6] | Validation API SANDBOX, webhook/réconciliation, choix prestataire, pays, devises, fiscalité, remboursement et support requis. |
| Conformité | À valider | Pages d’information existantes à adapter à la juridiction ciblée. [7] [8] [9] | Revue par un professionnel compétent avant allégation de conformité. |

## 2. Décisions et informations à obtenir avant une ouverture large

L’exploitant doit désigner un responsable opérationnel, un contact incident et un responsable des demandes de données personnelles. Il doit confirmer les pays de commercialisation, le régime fiscal, la monnaie, les plans, les limites de service, les canaux de support, les délais de réponse et le responsable juridique. Les coordonnées de contact, les sous-traitants, l’hébergement, la durée de conservation exacte et les modalités d’exercice des droits ne doivent être publiés qu’après confirmation factuelle.

| Décision | Propriétaire attendu | Statut | Effet tant que non confirmé |
|---|---|---|---|
| Juridictions et cadre de protection des données | Propriétaire et conseil compétent | À confirmer | Aucune promesse de conformité locale. |
| Politique de rétention par catégorie de données | Propriétaire et responsable données | À confirmer | Conservation limitée aux règles techniques existantes ; aucune purge automatique nouvelle. |
| Prestataire de paiement, devises et remboursements | Propriétaire | En pause SANDBOX | Aucun encaissement SaaS réel ni de test tant que le verrou technique reste fermé. |
| Revue de sécurité indépendante | Responsable technique et prestataire retenu | À planifier | Pilotage restreint et suivi renforcé. |
| Restauration témoin de recette | Responsable exploitation | À exécuter | Ne pas déclarer le RTO atteint en conditions réelles. |

## 3. Procédure incident et continuité

La première personne qui détecte un incident relève l’heure UTC, le périmètre concerné, le niveau d’impact et les identifiants techniques non sensibles. Elle ne communique ni secret, ni données client, ni contenu de fichier dans un canal non sécurisé. Elle préserve les journaux, limite l’accès si nécessaire par les mécanismes existants, puis informe le responsable opérationnel.

| Phase | Action | Critère de sortie |
|---|---|---|
| Détection | Qualifier sécurité, disponibilité, intégrité, synchronisation ou paiement. | Impact et périmètre explicitement identifiés. |
| Confinement | Révoquer les sessions concernées, suspendre l’accès ciblé ou arrêter la tâche en cause. | L’exposition ou la répétition est limitée. |
| Investigation | Examiner les journaux d’audit, santé des tâches et synchronisation sans exporter de données inutiles. | Hypothèse et preuves conservées. |
| Restauration | Tester d’abord le snapshot en recette, vérifier la portée entreprise, puis suivre la restauration contrôlée si autorisée. | Validation fonctionnelle du périmètre restauré. |
| Communication | Informer les parties concernées selon la politique et le droit applicables validés. | Message factuel, horodaté et approuvé. |
| Post-mortem | Documenter cause, impact, correctif, propriétaire et échéance. | Action corrective suivie jusqu’à clôture. |

## 4. Lancement pilote encadré

Le pilote doit accepter seulement des entreprises éligibles, informées des limites du mode offline et de l’absence actuelle de paiement SaaS intégré. Chaque entreprise pilote reçoit un interlocuteur de support, une consigne de sauvegarde, un parcours d’onboarding et une voie d’escalade. Le responsable exploitation suit quotidiennement les échecs de sauvegarde, jobs planifiés, synchronisations et incidents critiques ; il peut suspendre l’élargissement du pilote à tout signal répété.

Une ouverture commerciale large exige le feu vert formel du propriétaire, du responsable exploitation, du responsable technique et, selon les pays, des responsables juridiques et financiers. En cas de régression grave, la publication est arrêtée par checkpoint et le retour vers une version stable est évalué sans exécuter de suppression de données.

## 5. Liste de vérification de publication

- [ ] La restauration témoin a été exécutée sur des données de recette et son compte rendu est archivé.
- [ ] Une revue de sécurité indépendante ciblée a été réalisée et les écarts critiques sont traités ou acceptés formellement.
- [ ] Les juridictions, contacts, rétention, sous-traitants et documents publics sont validés par les responsables compétents.
- [ ] Le dispositif de support pilote, l’escalade d’incident et les plages de suivi sont attribués.
- [ ] Le prestataire de paiement, les conditions commerciales et la conformité fiscale sont validés avant toute activation du lot I.
- [ ] La recette de release est verte pour la version qui sera proposée aux utilisateurs.

## Références

[1]: ./scripts/verify-release.mjs "Recette de release — contrôle des routes et dépendances"
[2]: ./server/companyScope.ts "Contrôle serveur du périmètre entreprise"
[3]: ./server/_core/storageProxy.ts "Accès authentifié aux fichiers tenant-scopés"
[4]: ./RESUME_CONTINUITE_PROJET.md "Continuité, sauvegarde et restauration"
[5]: ./client/src/contexts/OfflineContext.tsx "File de synchronisation hors connexion"
[6]: ./PLAN_REMEDIATION_PRODUCTION_STOCKPILOT_2026-08-27.md "Lot I — paiement et abonnement SaaS"
[7]: ./client/src/pages/PrivacyPolicy.tsx "Politique de confidentialité"
[8]: ./client/src/pages/TermsOfUse.tsx "Conditions d’utilisation"
[9]: ./client/src/pages/SecurityPolicy.tsx "Politique de sécurité"
