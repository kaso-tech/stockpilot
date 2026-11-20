# Audit de préparation commerciale — StockPilot Pro

**Évaluation : 26 août 2026**  
**Périmètre :** lecture du code, de la configuration, des tests et des mécanismes opérationnels disponibles dans le projet.  
**Nature :** avis technique et produit ; il ne remplace ni un audit de sécurité indépendant, ni l’avis d’un conseil juridique ou fiscal local.

## Conclusion franche

StockPilot Pro est déjà une **application métier avancée**, adaptée à un pilote encadré avec quelques entreprises clientes. La gestion des produits, ventes, tickets, factures, entrepôts, transferts, agents, permissions locales, alertes, fonctionnement hors connexion et sauvegardes offre une base fonctionnelle nettement supérieure à un prototype.

En revanche, je ne recommande pas encore de la présenter comme un SaaS totalement industrialisé, avec acquisition autonome et paiement en ligne. Les écarts principaux concernent la **sauvegarde complète des données récentes**, le **paiement/abonnement SaaS**, l’**exploitation de production**, la **récupération de compte**, les **e-mails transactionnels** et la **conformité contractuelle**.

> **Verdict :** prêt pour une commercialisation pilote et accompagnée, mais pas encore prêt pour une vente autonome à grande échelle.

## Niveau de préparation actuel

| Domaine | Niveau estimé | État | Observation principale |
|---|---:|---|---|
| Fonctionnalités métier | 8/10 | Solide | Stocks, POS, documents, multi-entrepôts, agents, alertes et PWA sont déjà riches. |
| Cloisonnement multi-entreprise | 7/10 | Avancé | Les nouvelles opérations sont largement portées par `companyId` et les contrôles de périmètre sont présents. |
| Sécurité applicative | 6/10 | À renforcer | Sessions, rôles, validations et rate limiting existent, mais un audit externe et des protections d’exploitation restent nécessaires. |
| Sauvegarde et reprise | 4/10 | Bloquant pour la vente large | Les sauvegardes existent, mais leur périmètre ne couvre pas encore toutes les tables récemment ajoutées. |
| Exploitation et supervision | 4/10 | Insuffisant | Les tests existent mais la supervision, l’alerte d’incident et le plan de reprise ne sont pas encore industrialisés. |
| Support client | 6/10 | Bon début | Formulaire sécurisé, captures et registre administratif sont disponibles ; il manque le workflow de support et les canaux transactionnels. |
| Paiement et abonnement SaaS | 2/10 | Manquant | Aucun système de plans, d’abonnements, de transactions, de webhooks ou de restrictions par offre n’est implémenté. |
| Conformité et commercial | 3/10 | À finaliser | Les pages légales existent comme base, mais doivent être adaptées à votre juridiction, à vos données et à votre modèle commercial. |

## Points déjà solides

L’application possède des éléments importants pour un logiciel de gestion de stock professionnel. L’authentification par e-mail et mot de passe, les sessions multi-appareils, la révocation de session et le rate limiting de connexion sont disponibles. Les opérations métiers sensibles sont structurées autour des entreprises et des entrepôts, avec des rôles locaux, des journaux d’audit et des validations côté serveur.

Le périmètre métier est particulièrement avancé : ventes rapides, encaissements, factures, devis, tickets différés, fournisseurs, réceptions, inventaires, transferts, alertes locales, commissions et support sécurisé. Le projet dispose également de contrôles TypeScript, d’une suite automatisée de **231 tests**, d’un build PWA et d’une vérification de publication qui contrôle notamment l’absence d’accès anonyme au tableau de bord et aux sauvegardes.

| Capacité existante | Apport pour une vente pilote |
|---|---|
| Multi-entreprise et multi-entrepôts | Permet de servir plusieurs structures sans mélanger leurs opérations. |
| PWA et file hors connexion | Réduit la dépendance à une connexion stable pour les ventes terrain. |
| Rôles, vendeurs et responsables de dépôt | Permet un déploiement réaliste dans une entreprise cliente. |
| Transferts, seuils et alertes locales | Répond aux besoins opérationnels de plusieurs sites de stockage. |
| Backups, audit et support intégré | Donne une base de confiance et de traçabilité pour un pilote. |

## Écarts critiques avant une vente à grande échelle

### 1. Sauvegardes et restauration à compléter — priorité absolue

Le système de sauvegarde par entreprise fonctionne, stocke les archives et propose une restauration contrôlée. Cependant, le périmètre sauvegardé est une liste fixe qui ne couvre pas toutes les structures récentes : entrepôts, stocks localisés, transferts, rôles locaux, affectations, préférences d’entrepôt, seuils, alertes locales, demandes de support et plusieurs données liées aux nouvelles fonctions peuvent ne pas être intégralement restaurés.

La restauration remplace de manière destructive les données sauvegardées du périmètre concerné. Avant de commercialiser largement, il faut donc élargir la sauvegarde à toutes les tables métier, versionner le format de backup, tester une restauration dans un environnement isolé et rédiger une procédure de reprise après incident.

> Le précédent incident de données non visibles a confirmé que la récupération et le rattachement de périmètre doivent être traités comme une capacité de production, pas seulement comme une correction ponctuelle.

### 2. Abonnement, paiement et facturation du SaaS — manquant

Le code ne contient actuellement ni offre tarifaire, ni abonnement, ni transaction SaaS, ni webhook de paiement, ni contrôle d’accès lié à un plan. Vous pouvez donc vendre dans un premier temps avec une facturation manuelle et un accompagnement humain, mais pas avec un parcours autonome « inscription → essai → paiement → activation ».

Pour vendre de façon répétable, il faut ajouter des plans, un statut d’abonnement par entreprise, des transactions, une date d’expiration, des limitations contrôlées côté serveur et un prestataire de paiement adapté à vos marchés. L’activation d’un abonnement doit toujours provenir d’une confirmation serveur du paiement, jamais d’un retour frontal.

### 3. E-mails transactionnels et récupération de compte — manquants

L’application dispose de pages de support et de notifications internes, mais le canal e-mail transactionnel a été reporté. Il manque donc les e-mails de réinitialisation de mot de passe, de vérification de compte, de confirmation de paiement, de réponse support et d’alerte critique.

Il faut intégrer un prestataire transactionnel, mettre en place une réinitialisation de mot de passe avec jeton à durée de vie courte, tracer les actions sensibles et prévoir une politique de délivrabilité. L’ancien flux OAuth présent dans l’infrastructure doit aussi être clairement désactivé ou maintenu avec une stratégie documentée pour éviter la confusion des parcours de connexion.

### 4. Exploitation de production et supervision — insuffisantes

Les contrôles actuels sont utiles, mais `verify:release` ne vérifie que la page publique et deux routes protégées. Il manque au minimum une supervision des erreurs applicatives, des alertes de disponibilité, des métriques sur les requêtes, l’échec des sauvegardes, l’espace de stockage, les jobs planifiés et le taux d’échec de synchronisation hors ligne.

Une mise en production commerciale doit aussi disposer d’un environnement de préproduction, de migrations vérifiées avant déploiement, d’un rollback documenté, d’une rotation des secrets et d’un plan d’incident comprenant les responsables, délais et communications client.

### 5. Conformité, contrats et confiance client — à finaliser

Les pages Conditions, Politique de sécurité et Contact constituent une bonne base d’interface. Elles doivent toutefois être adaptées à votre pays de vente, à vos obligations de protection des données, à la durée de conservation, aux sous-traitants, au traitement des sauvegardes et aux responsabilités de chaque partie. Il faut également prévoir un contrat ou des conditions SaaS précisant les niveaux de service, la propriété des données, la procédure d’export, la suppression de compte et les limitations de responsabilité.

## Recommandation de lancement

Je recommande un lancement en deux temps. La première étape est un **pilote payant accompagné**, limité à quelques entreprises choisies et facturées manuellement. Vous pouvez alors assurer vous-même l’onboarding, vérifier les sauvegardes, accompagner les rôles et entrepôts, et recueillir les incidents réels. Ne promettez pas encore de disponibilité contractuelle élevée ni de récupération immédiate sans avoir testé le plan de reprise complet.

La seconde étape est une vente autonome, une fois les blocs ci-dessous terminés.

| Priorité | À réaliser | Condition de sortie |
|---|---|---|
| P0 — Avant tout contrat large | Sauvegarde complète de toutes les tables, restauration en environnement isolé, procédure de reprise | Une restauration testée recrée intégralement une entreprise récente, y compris entrepôts, rôles et transferts. |
| P0 — Avant ouverture publique | Supervision des erreurs, alerte de sauvegarde échouée, journal de déploiement et rollback | Une équipe peut détecter et traiter un incident sans dépendre d’une enquête manuelle. |
| P0 — Avant données sensibles à grande échelle | Audit sécurité externe, revue des permissions, politique de secrets et durcissement HTTP | Les risques connus sont documentés, priorisés et corrigés ou assumés contractuellement. |
| P1 — Avant vente autonome | Plans, abonnements, paiement réel, webhook validé et restrictions serveur | Un client peut s’inscrire, payer, être activé et gérer son abonnement sans intervention humaine. |
| P1 — Avant support commercial | E-mails transactionnels, mot de passe oublié, vérification de compte et notifications support | Les parcours de compte et de support ne dépendent plus d’un contact manuel. |
| P1 — Avant engagement contractuel fort | Conditions, confidentialité, sécurité, DPA et traitement fiscal relus localement | Les documents correspondent réellement à votre pays, vos prix et vos traitements de données. |
| P2 — Après les premiers clients | Mesures de performance, tests de charge, SLO, portail statut et base de connaissance | L’exploitation peut grandir sans dégrader la qualité de service. |

## Décision conseillée aujourd’hui

Vous pouvez commencer à **vendre une offre pilote assistée** à des clients de confiance, avec abonnement ou facturation manuelle, à condition de leur présenter le produit comme une version de déploiement accompagné. Avant de proposer une vente autonome au public, priorisez d’abord la sauvegarde complète et testée, puis le paiement/abonnement, l’e-mail transactionnel, l’observabilité et la conformité.

La prochaine fonctionnalité la plus rentable n’est pas une nouvelle fonction de stock : c’est un **socle commercial et opérationnel** composé de sauvegardes complètes, plans d’abonnement, paiement vérifié, e-mails transactionnels et supervision.
