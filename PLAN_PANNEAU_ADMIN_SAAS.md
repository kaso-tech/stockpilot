# Panneau d’administration SaaS — Cadrage recommandé

**Date :** 26 août 2026  
**Statut :** proposition de cadrage avant implémentation

## Décision recommandée

StockPilot Pro doit disposer de **deux niveaux d’administration strictement séparés**.

| Niveau | Utilisateurs | Périmètre | Finalité |
|---|---|---|---|
| Administration d’entreprise | Administrateurs des entreprises clientes | Une seule entreprise, ses dépôts et ses utilisateurs | Exploiter l’activité quotidienne |
| Administration SaaS | Équipe StockPilot explicitement autorisée | Plateforme, entreprises, abonnements, santé et support | Exploiter et commercialiser le produit |

> Un administrateur client ne doit jamais pouvoir consulter la liste des autres entreprises, leurs utilisateurs, leurs chiffres ou leurs demandes de support. Inversement, un opérateur StockPilot ne doit pas ouvrir librement les données métier d’un client.

L’application possède déjà une administration d’entreprise solide : les procédures `adminProcedure` contrôlent le rôle `admin`, les données métier sont filtrées par `companyId`, les dépôts et les rôles locaux sont séparés, et les demandes de support sont cloisonnées par entreprise. Ce socle ne doit **pas** devenir le panneau SaaS par simple extension : cela créerait un risque de fuite inter-entreprise.

## Ce qui existe et ce qui manque

| Capacité | État actuel | Écart pour le SaaS |
|---|---|---|
| Administrateur d’entreprise | Disponible | À conserver séparé du rôle plateforme |
| Isolation par entreprise | Disponible dans les flux métier principaux | À rendre non contournable dans toute future route plateforme |
| Audit métier | Disponible | Ajouter un audit plateforme distinct et immuable |
| Support | Registre limité à l’entreprise | Ajouter une file SaaS, sans exposition automatique du contenu métier |
| Sauvegardes | Par entreprise | Ajouter le suivi central de réussite, taille et restauration testée |
| Plans et abonnements | Absent | Créer plans, souscriptions, factures SaaS et webhooks vérifiés |
| Santé de la plateforme | Absente | Ajouter indicateurs de disponibilité, erreurs, synchronisation et stockage |
| Gestion des entreprises | Inscription et création disponibles | Ajouter cycle de vie : essai, actif, suspendu, résilié |
| Accès support exceptionnel | Absent | Ajouter un accès temporaire, consenti, limité et entièrement audité |

## Périmètre fonctionnel du panneau SaaS

### 1. Vue d’ensemble — cockpit plateforme

La page d’accueil du panneau affiche uniquement des agrégats de plateforme : nombre d’entreprises actives, nouvelles inscriptions, entreprises en essai, souscriptions arrivant à échéance, sauvegardes en échec, erreurs de synchronisation, demandes de support ouvertes et disponibilité applicative. Elle ne doit pas exposer les ventes, clients, stocks ou montants détaillés d’une entreprise sans une autorisation de support explicite.

### 2. Entreprises et cycle de vie

Cette section gère les informations opérationnelles minimales d’une entreprise : nom, date d’inscription, état d’onboarding, plan, statut de souscription, dernier accès, volume de stockage, statut de sauvegarde et état de compte. Les actions autorisées doivent rester mesurées : suspendre l’accès, réactiver, prolonger un essai, déclencher une sauvegarde et demander une exportation.

Une suspension doit être réversible, motivée et auditée. Elle ne doit jamais supprimer les données du client.

### 3. Abonnements, offres et facturation SaaS

Le panneau doit centraliser les offres Pilote, Pro et Entreprise, les limites par plan, les périodes d’essai, les souscriptions, transactions et incidents de paiement. Cette section ne doit être activée qu’avec un prestataire de paiement et des webhooks validés côté serveur.

| Élément | Règle de sécurité |
|---|---|
| Statut d’abonnement | Écrit uniquement depuis le serveur après événement de paiement vérifié |
| Limites de plan | Appliquées dans les routes serveur, jamais seulement dans l’interface |
| Suspension pour impayé | Délais, motif et période de grâce clairement tracés |
| Factures SaaS | Références de paiement non modifiables après validation |

### 4. Support et demandes client

Les demandes d’assistance existantes peuvent alimenter une file de support centrale via des métadonnées limitées : entreprise, priorité, statut, date, sujet et responsable. Le contenu de la demande et ses captures ne doivent être ouverts que par des opérateurs habilités.

La fonctionnalité de support doit prévoir des commentaires internes, une réponse client, des SLA, une priorité, une attribution à un opérateur et une trace de chaque changement de statut.

### 5. Sécurité, audit et accès exceptionnel

Le panneau doit distinguer les opérateurs **plateforme** des utilisateurs clients. Les opérateurs plateforme sont ajoutés par liste blanche, avec authentification renforcée dès que possible et permissions minimales.

Lorsqu’un incident exige une consultation de données client, l’outil doit créer une demande d’accès temporaire avec : entreprise concernée, motif, périmètre, demandeur, approbateur, heure d’expiration et journal des consultations. L’accès par défaut reste **désactivé**. Aucun mécanisme d’impersonation silencieuse ne doit être implémenté.

### 6. Exploitation et résilience

Cette section suit les sauvegardes, restaurations testées, tâches planifiées, erreurs API, synchronisations hors connexion, stockage objet et incidents de déploiement. Les données doivent être synthétiques et ne pas contenir de secret ou de contenu client en clair.

## Modèle de données recommandé

| Table proposée | Finalité |
|---|---|
| `platformAdminUsers` | Liste blanche des opérateurs SaaS et permissions plateforme |
| `platformAuditLogs` | Journal append-only des actions de plateforme |
| `companyLifecycleEvents` | Essai, activation, suspension, résiliation et motifs |
| `subscriptionPlans` | Offres, limites et visibilité commerciale |
| `companySubscriptions` | Plan actif, période, statut et références de prestataire |
| `subscriptionTransactions` | Événements de paiement vérifiés et rapprochement |
| `supportAssignments` | Attribution, priorité, SLA et commentaires internes |
| `supportAccessGrants` | Accès exceptionnel temporaire, consenti et audité |
| `platformHealthEvents` | Échecs de sauvegarde, synchronisation, tâches et déploiements |

Toutes ces tables doivent être séparées des données métier et éviter de réutiliser `users.role = admin`, qui correspond déjà à l’administrateur de l’entreprise cliente.

## Navigation recommandée

| Section | Écrans |
|---|---|
| Vue plateforme | Synthèse, alertes, activité récente |
| Clients | Entreprises, statut, essais, capacité |
| Commercial | Offres, abonnements, transactions, relances |
| Support | File, priorités, SLA, demandes affectées |
| Exploitation | Sauvegardes, synchronisation, incidents, santé |
| Sécurité | Opérateurs, audit, accès temporaires, politiques |
| Réglages plateforme | Marque, fournisseurs, règles, limites |

Cette navigation doit être rendue dans une **application ou coque distincte** de l’espace client, avec une route dédiée, une protection serveur spécifique et une bannière permanente indiquant le contexte plateforme.

## Feuille de route priorisée

### P0 — nécessaire avant administration SaaS opérationnelle

1. Créer un rôle plateforme séparé, une liste blanche d’opérateurs et un middleware dédié.
2. Créer le journal d’audit plateforme append-only.
3. Construire la liste des entreprises avec métadonnées non sensibles et cycle de vie réversible.
4. Centraliser les alertes de sauvegarde et de synchronisation sans afficher de données métier.
5. Compléter les sauvegardes afin de couvrir toutes les tables récentes, puis tester une restauration isolée.

### P1 — nécessaire avant commercialisation autonome

1. Mettre en place plans, essais, abonnements, transactions et webhooks de paiement vérifiés.
2. Ajouter une file de support centrale avec SLA, réponses et commentaires internes.
3. Intégrer e-mails transactionnels, récupération de compte et notifications de facturation.
4. Ajouter le mécanisme d’accès support temporaire et audité.

### P2 — industrialisation

1. Ajouter indicateurs de santé, erreurs, disponibilité et capacité.
2. Créer des exports de conformité et de facturation.
3. Ajouter une procédure de suspension, export et suppression de compte conforme aux contrats applicables.
4. Mettre en place un environnement de préproduction et des tests de charge ciblés.

## Recommandation de mise en œuvre

La prochaine étape devrait être le **lot P0 du panneau SaaS**, sans y intégrer encore le paiement. Il donnera une base sûre pour suivre les entreprises, les sauvegardes, les incidents et les demandes de support, tout en protégeant strictement les données clients. Une fois ce socle stabilisé, le paiement et les abonnements pourront être ajoutés comme un module commercial indépendant.
