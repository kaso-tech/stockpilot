# StockPilot Pro — Planning directeur de mise en place de A à Z

**Version :** 1.0  
**Date :** 26 août 2026  
**Statut :** feuille de route de référence à exécuter par lots publiables  
**Horizon :** du pilote accompagné à une commercialisation SaaS autonome et industrialisée

## 1. Finalité et décision directrice

StockPilot Pro doit progresser sans interrompre les opérations déjà disponibles : stocks, ventes rapides, factures, encaissements, achats, inventaires, multi-entrepôts, agents, PWA et fonctionnement hors connexion. La trajectoire proposée transforme ce socle métier en un **service SaaS vendable, administrable et exploitable**, tout en maintenant une séparation stricte entre les entreprises clientes et l’équipe StockPilot.

> Le produit ne doit pas chercher à devenir « complet » par accumulation de pages. Chaque lot doit renforcer l’un des quatre résultats mesurables : protection des données, continuité d’activité, autonomie commerciale ou qualité d’exploitation.

L’application peut soutenir un **pilote payant accompagné**, mais la vente autonome à grande échelle reste conditionnée par la sauvegarde complète et testée, l’exploitation de production, les parcours de compte, les abonnements/paiements et la conformité locale. [1]

| Principe | Décision de mise en œuvre |
|---|---|
| Isolation client | Toute donnée métier, fichier, cache, export et sauvegarde reste scellé par entreprise et, si nécessaire, par entrepôt et utilisateur. |
| Console plateforme | Elle gère les métadonnées d’exploitation ; elle n’ouvre pas les ventes, clients, stocks ou documents d’un client par défaut. |
| Offline | IndexedDB, outbox idempotente, synchronisation observable et résolution explicite des conflits. Le serveur reste la référence finale. |
| Paiement SaaS | Activation et renouvellement exclusivement après vérification serveur d’un événement du prestataire. |
| Publication | Changements ciblés, migration non destructive, tests, build, recette et checkpoint publiable à chaque lot. |
| Confidentialité | Aucun secret, mot de passe, hash, identifiant personnel, document ou donnée client ne doit être exposé dans les journaux, exports ou interfaces administratives. |

## 2. Point de départ au 26 août 2026

Le socle métier est riche et plusieurs protections sont déjà en place : multi-entreprise, multi-entrepôts, rôles locaux, transferts, alertes, sessions internes, support avec captures, sauvegardes, PWA/offline et tests de non-divulgation sur les parcours critiques. La console plateforme P0 existe déjà : rôle distinct, liste blanche, audit global, liste d’entreprises, suspension motivée et réactivation. [1] [2]

Les écarts qui empêchent encore l’autonomie commerciale sont résumés ci-dessous.

| Domaine | Situation actuelle | Niveau de priorité |
|---|---|---|
| Sauvegarde et reprise | Sauvegardes présentes, mais couverture et restauration récente à rendre exhaustives et reproductibles. | Bloquant avant vente large |
| Observabilité | Tests et journalisation existent ; supervision, alertes et procédures d’incident restent à industrialiser. | Bloquant avant engagement de service |
| Console SaaS | P0 sécurisé mais volontairement minimal. | P1 immédiat |
| Support | Formulaire sécurisé et registre client disponibles ; workflow central, SLA et attribution restent à créer. | P1 immédiat |
| Compte et e-mail | Auth interne disponible ; e-mails transactionnels, vérification et récupération restent reportés. | P1 |
| Offres et abonnement | Page tarifaire informative seulement ; pas de souscription, paiement, webhook ou contrôle de plan. | P1 |
| Conformité | Pages de base prêtes ; textes, conservation, sous-traitance et contrats doivent être validés localement. | Bloquant avant contrats étendus |

## 3. Gouvernance du programme

Le programme est mené sous forme de **lots courts, indépendamment publiables**. Un lot ne peut pas modifier les comportements POS, factures, encaissements ou offline existants sans tests de non-régression explicites. Les migrations sont additives autant que possible, relues avant application et accompagnées d’une stratégie de retour arrière applicative.

| Rôle | Responsabilité principale |
|---|---|
| Propriétaire produit | Valide les priorités marché, les offres, les règles d’accès, les messages clients et la publication commerciale. |
| Responsable technique | Conçoit les contrats serveur, migrations, intégrations, revue de sécurité et validations techniques. |
| Référent exploitation | Suit sauvegardes, incidents, disponibilité, déploiements, stockage et procédures de reprise. |
| Référent support | Qualifie les demandes, maintient la base de connaissance, applique les SLA et remonte les anomalies récurrentes. |
| Conseil juridique/fiscal local | Valide les documents contractuels, protection des données, taxes, factures SaaS et règles de conservation. |

Chaque lot comporte obligatoirement une définition du périmètre, des critères d’acceptation, une matrice de permissions, des tests, une recette visuelle clair/sombre, une note de continuité et un checkpoint. Les actions de plateforme sensibles doivent toujours créer une trace d’audit immuable.

## 4. Architecture cible à préserver

L’architecture cible conserve une infrastructure partagée mais impose un périmètre logique strict : **entreprise → entrepôt/point de vente → utilisateur → rôle**. Toute route serveur dérive l’entreprise de la session vérifiée plutôt que d’un identifiant soumis par le navigateur. Les fichiers, sauvegardes et caches locaux restent également compartimentés. [3]

| Couche | Règle cible |
|---|---|
| Base de données | `companyId` obligatoire pour toute nouvelle donnée métier ; contraintes et index composites quand l’unicité est propre à une entreprise. |
| API | Contrôles centraux de session, entreprise, entrepôt, rôle, plan et statut de souscription avant lecture ou écriture. |
| PWA | Données locales limitées au périmètre actif ; purge contrôlée au changement de compte ou d’entreprise ; aucune clé globale métier. |
| Stockage fichier | Préfixe par entreprise, vérification d’autorisation avant URL temporaire, type/poids/signature contrôlés. |
| Plateforme | Routes, tables, rôles et journal dédiés ; métadonnées par défaut ; accès support exceptionnel seulement avec consentement et durée limitée. |
| Production | Environnements distincts, migrations vérifiées, secrets rotatifs, surveillance et plan de reprise documenté. |

## 5. Feuille de route complète par phases

Les durées ci-dessous correspondent à des **ordres de mise en œuvre**, non à une promesse de calendrier. Les phases peuvent se chevaucher uniquement lorsque leurs dépendances et leurs risques sont maîtrisés.

### Phase 0 — Stabilisation et gouvernance de livraison

Cette phase sécurise la manière de livrer avant d’ajouter de nouveaux modules. Elle est continue, mais doit être confirmée avant les phases commerciales.

| Livrable | Actions | Critère de sortie |
|---|---|---|
| Baseline reproductible | Répertorier versions, migrations appliquées, scripts de test, procédure de checkpoint et restauration applicative. | Une nouvelle session peut reprendre sans écraser le travail partagé. |
| Discipline de données | Revue des migrations, interdiction de suppressions implicites, inventaire avant tout rattachement ou correction de périmètre. | Aucune opération à risque n’est faite sans trace et validation adaptée. |
| Qualité d’interface | Tokens sémantiques, contraste clair/sombre, états loading sur actions critiques, navigation mobile testée. | Les nouvelles pages n’imposent plus une palette qui casse le thème actif. |
| Documentation de continuité | Mettre à jour le résumé projet et le présent planning à chaque jalon significatif. | Le statut, les dettes et les prochaines actions sont explicites. |

### Phase 1 — Intégrité des données, sauvegarde et reprise

Cette phase est le premier véritable jalon avant une commercialisation étendue. Elle traite la récupération comme une fonction produit et d’exploitation.

| Sous-lot | Contenu | Dépendances | Preuve requise |
|---|---|---|---|
| 1.1 Inventaire de couverture | Cartographier toutes les tables métier et enfants : entrepôts, stocks locaux, transferts, rôles, affectations, alertes, support, paramètres et historiques. | Schéma courant | Matrice « table → sauvegarde → restauration → test ». |
| 1.2 Format de sauvegarde versionné | Ajouter version de schéma, manifeste, intégrité, taille, date, entreprise, chiffrement et rétention. | 1.1 | Archive lisible par version et rejetée si incompatible. |
| 1.3 Restauration isolée | Restaurer dans un environnement non productif ou un périmètre de test, jamais directement sans validation. | 1.2 | Restauration complète d’une entreprise récente, y compris multi-entrepôts. |
| 1.4 Procédure d’incident | Définir déclenchement, responsables, communication, objectifs RPO/RTO, export de secours et reprise. | 1.3 | Exercice de reprise documenté et chronométré. |
| 1.5 Tests de non-fuite | Vérifier restauration, téléchargement, suppression et rétention entre deux entreprises de test. | 1.2 | Refus explicite de tout accès inter-entreprise. |

> Aucune promesse de récupération rapide, de continuité forte ou de vente large ne doit être formulée avant que cette phase soit validée de bout en bout. [1]

### Phase 2 — Console plateforme P1 : exploitation utile et sécurisée

P0 a posé le rôle distinct et le cycle de vie. P1 transforme la console en **cockpit d’exploitation** sans l’ouvrir aux données métier.

| Sous-lot | Fonctionnalités | Règles de sécurité |
|---|---|---|
| 2.1 Cockpit de santé | Entreprises actives, essais, suspensions, sauvegardes récentes, échecs, synchronisations en erreur, support ouvert et tâches planifiées. | Agrégats et statuts uniquement ; pas de détail métier. |
| 2.2 Fiche entreprise plateforme | Plan, essai, statut administratif, onboarding, dernier accès, capacité, sauvegarde, incidents et événements de cycle de vie. | Contacts strictement nécessaires ; aucune liste de clients, vente ou stock. |
| 2.3 Recherche et segmentation | Filtres statut, plan, essai, santé, activité, support ; pagination serveur ; export administratif limité. | Exports anti-formule, sans données métier ni identifiants sensibles inutiles. |
| 2.4 Opérateurs plateforme | Invitation contrôlée, rôles `super_admin`, `operations`, `support`, `billing`, révocation, journal et moindre privilège. | Aucun rôle client réutilisé ; validation serveur de chaque permission. |
| 2.5 Audit et accès exceptionnel | Journal append-only ; demande d’accès temporaire avec motif, périmètre, approbateur, expiration et preuve de consultation. | Aucun mode impersonation silencieux ; accès désactivé par défaut. |

### Phase 3 — Support client structuré et e-mails transactionnels

Le support doit devenir un processus mesurable, sans permettre à un opérateur de contourner la confidentialité d’une entreprise.

| Sous-lot | Contenu | Critère de sortie |
|---|---|---|
| 3.1 File de support centrale | Attribution, priorité, statut, catégories, échéance SLA, notes internes et historique. | Une demande est suivie du début à la clôture par un opérateur désigné. |
| 3.2 Réponses et notifications | Réponses client, confirmation de création, changement de statut, rappel SLA et messages d’incident. | Tous les envois sont traçables sans inclure de secret. |
| 3.3 Fournisseur e-mail | Choisir, configurer et tester un service transactionnel avec domaine expéditeur, délivrabilité, limites et gestion d’échec. | Un environnement de test reçoit les messages de cycle de compte et support. |
| 3.4 Récupération de compte | Mot de passe oublié, jeton à usage unique et à courte durée, révocation des sessions si nécessaire. | Aucun compte n’est récupérable par simple connaissance d’informations publiques. |
| 3.5 Vérification d’e-mail et sécurité renforcée | Vérification avant activation commerciale ; MFA pour opérateurs et administrateurs à haut privilège si le marché le justifie. | Les comptes critiques disposent de protections adaptées. |

### Phase 4 — Abonnements, essais, offres et facturation SaaS

Cette phase rend la vente répétable. Le paiement de l’abonnement StockPilot est distinct des encaissements gérés par les clients dans leur activité.

| Sous-lot | Contenu | Règle non négociable |
|---|---|---|
| 4.1 Catalogue d’offres | Plans Essentiel, Professionnel, Business et Entreprise ; modules, limites, période, essais, fonctionnalités et prix validés par le propriétaire produit. | Les limitations reflètent une politique serveur, pas seulement des libellés UI. |
| 4.2 Modèle de souscription | `subscriptionPlans`, souscription entreprise, état, date d’essai, renouvellement, grâce, expiration et historique. | L’entreprise, non un simple utilisateur, est titulaire de l’abonnement. |
| 4.3 Contrôle d’entitlements | Vérification centralisée des modules et quotas : utilisateurs, dépôts, produits, appareils offline, stockage et exports. | Chaque route premium vérifie le droit côté serveur. |
| 4.4 Prestataire de paiement | Choisir le prestataire du marché, enregistrer les secrets via la gestion dédiée, intégrer initiation, retour, vérification et webhooks signés. | Aucun abonnement n’est activé sur un simple retour du navigateur. |
| 4.5 Transactions et factures SaaS | Référence de transaction, rapprochement, reçus/factures SaaS, remboursement, échec, relance et idempotence webhook. | Les événements confirmés ne sont pas modifiables. |
| 4.6 Portail client | Consulter plan, période, facture SaaS, moyen de paiement et demande de changement ; sans exposer de données d’un autre client. | Les actions sensibles exigent un administrateur/propriétaire de l’entreprise. |

Le choix précis des prix, taxes et moyens de paiement dépend du pays de lancement et doit être validé avant de coder les flux irréversibles.

### Phase 5 — Offline-first durable et gestion des appareils

Le socle IndexedDB et la file d’opérations existent déjà ; cette phase vise la robustesse sur plusieurs jours, appareils et retours réseau.

| Sous-lot | Actions | Validation terrain |
|---|---|---|
| 5.1 Données locales nécessaires | Snapshots segmentés de produits, clients, agents, stock local, prix, taxes, moyens de paiement et identité d’impression. | Consultation et vente testées sans réseau sur le dépôt actif. |
| 5.2 Outbox et synchronisation | Ordonnancement, reprise, idempotence, curseurs incrémentaux, tentative contrôlée et blocage des doublons. | Réenvoi répété d’une opération sans double vente ni double encaissement. |
| 5.3 Conflits | Politique explicite par ressource, écran de décision, preuve de résolution et remontée au responsable. | Aucun écrasement silencieux de prix, stock ou réglage. |
| 5.4 Appareils | Diagnostic de stockage, version PWA, dernière synchro, file en attente, déconnexion sûre et purge contrôlée. | Un appareil peut être réinitialisé sans perdre une opération non synchronisée. |
| 5.5 Limites de paiement | Règles distinctes cash, mobile money et carte ; avertissement des opérations provisoires si nécessaire. | Aucun paiement non garanti n’est présenté comme confirmé. |

### Phase 6 — Sécurité applicative, données et conformité

Cette phase est transversale et doit être livrée avant les engagements contractuels importants.

| Axe | Travaux | Critère de sortie |
|---|---|---|
| Isolation multi-entreprise | Revue route par route, tables enfants, contraintes composées, fichiers, exports, caches et jobs. | Tests adversariaux A/B sur chaque domaine sensible. |
| Authentification et sessions | Politique de mot de passe, e-mail vérifié, récupération, MFA sensible, sessions, détection et révocation. | Les scénarios de compte compromis sont documentés et testés. |
| Protection applicative | Validation Zod, anti-injection, XSS/HTML d’impression échappé, rate limits, upload contrôlé, en-têtes HTTP et logs minimisés. | Revue sécurité interne sans secret ni donnée privée dans les logs. |
| Audit externe | Faire examiner le produit par un spécialiste indépendant avant ouverture large. | Rapport, priorités et plan de correction validés. |
| Conformité | Conditions SaaS, politique de confidentialité, sécurité, DPA, conservation, sous-traitants, export/suppression et fiscalité. | Documents relus et validés pour le pays de vente. |

### Phase 7 — Exploitation de production et fiabilité

La plateforme doit pouvoir être surveillée, diagnostiquée et restaurée sans enquête improvisée.

| Sous-lot | Mesures attendues |
|---|---|
| Observabilité applicative | Capture d’erreurs, métriques de requêtes, latence, taux d’échec, alertes non bruyantes et corrélation par incident. |
| Santé métier | Échecs de sauvegarde, tâches planifiées, synchronisation offline, stockage, migrations et webhooks. |
| Déploiement | Préproduction, checklist migration, smoke tests post-déploiement, journal de version, rollback applicatif documenté. |
| Incidents | Niveaux de sévérité, responsables, canal de communication, délais, post-mortem et actions préventives. |
| Capacité | Seuils de stockage, base, fichiers, mémoire, requêtes lentes et plan de montée en charge. |
| Portail statut | Page publique de disponibilité et historique d’incidents lorsque le volume de clients le justifie. |

### Phase 8 — Qualité, performance et accessibilité

| Domaine | Programme |
|---|---|
| Tests automatisés | Unitaires, contrats de route, isolation A/B, migrations, restauration, offline, paiement/webhooks et permissions plateforme. |
| Recette métier | Scénarios POS, facture, encaissement, transfert, inventaire, support, suspension, récupération et abonnement. |
| Navigateurs et mobile | Android/iOS récents, petit écran, clavier, impression, PWA, perte de réseau et reprise. |
| Performance | Pagination, index de base, requêtes ciblées, cache raisonné, tests de charge sur flux critiques. |
| Accessibilité | Contraste, focus clavier, libellés, dialogue, messages d’erreur et état de chargement. |
| Sécurité de régression | Test statique et visuel pour les tokens sémantiques ; aucun écran ne force une palette incompatible avec le thème actif. |

### Phase 9 — Onboarding, documentation et préparation commerciale

| Sous-lot | Contenu |
|---|---|
| Onboarding entreprise | Inscription, identité, premier dépôt, moyens de paiement, catalogue, rôles, appareil offline et vente test. |
| Documentation client | Guides administrateur, vendeur, caissier, responsable de dépôt, offline, synchronisation, sauvegarde et sécurité. |
| Formation | Parcours de démonstration, jeu de données non sensible, checklists d’installation et support de formation. |
| Matériel commercial | Page tarifs validée, description par offre, limites claires, politique de support et conditions. |
| Réussite client | Checklist d’activation, suivi à 7/30 jours, adoption des utilisateurs et rétention. |

### Phase 10 — Pilote payant accompagné

Le pilote est une phase de validation, non une simple prévente. Il doit démarrer avec un nombre réduit d’entreprises volontaires, une facturation manuelle ou semi-manuelle, un contact désigné, des limites explicites et un protocole de remontée d’incidents.

| Étape | Décision / preuve |
|---|---|
| Sélection | Choisir des commerces représentatifs : mono-site, multi-dépôt, connexion instable, équipe de vente. |
| Contrat pilote | Définir support, données, sauvegarde, limites de service, durée et collecte de retours. |
| Mise en service | Migrer ou configurer avec sauvegarde initiale, formation et vente de test. |
| Suivi | Revue hebdomadaire : incidents, synchronisation, temps de support, adoption, restauration et satisfaction. |
| Sortie | Corriger les défauts de classe, valider les critères de lancement et décider de l’ouverture publique. |

### Phase 11 — Vente autonome et lancement public

L’ouverture publique n’est autorisée qu’après validation de tous les garde-fous P0/P1 ci-dessous.

| Go / no-go | Preuve minimale |
|---|---|
| Sauvegarde | Restauration complète et isolée testée sur des données représentatives. |
| Sécurité | Revue des permissions, secrets, isolation et audit externe ou analyse indépendante. |
| Compte | Vérification e-mail, récupération sécurisée, gestion de session et canal d’assistance actifs. |
| Commercial | Plans, essai, paiement, webhook, entitlements et factures SaaS testés de bout en bout. |
| Exploitation | Alertes, incident response, préproduction, rollback et propriétaire de chaque alerte. |
| Support | SLA défini, file centrale, documentation et capacité de réponse mesurée. |
| Légal | Documents validés dans la juridiction et processus d’export/suppression publiés. |

### Phase 12 — Croissance, grands comptes et amélioration continue

Après le lancement, les améliorations doivent être ordonnées par impact client et risque : intégrations comptables, matériel POS, API partenaire, rôles personnalisés, SSO, environnement dédié, SLA, rapports avancés, portail statut, offres annuelles, facturation régionale et analytics produit respectueux de la confidentialité.

## 6. Dépendances et ordre d’exécution obligatoire

| Ordre | Dépend de | Ne pas démarrer avant |
|---:|---|---|
| 1 | Phase 0 | Baseline, règles de migration et checklist de publication. |
| 2 | Phase 1 | Inventaire exhaustif de sauvegarde et restauration isolée. |
| 3 | Phase 2 et 7 | Rôles plateforme, audit, santé de sauvegarde et procédures d’incident. |
| 4 | Phase 3 | Prestataire e-mail, identité expéditeur et règles de délivrabilité. |
| 5 | Phase 4 | Pays, offres, prix, taxes, prestataire et politique de facturation validés. |
| 6 | Phase 5 | Tests d’idempotence, stratégie de conflit et capacité de support terrain. |
| 7 | Phase 6 et 8 | Revue sécurité, conformité, tests adversariaux et recette. |
| 8 | Phase 10 | Critères go/no-go précédents et entreprises pilotes sélectionnées. |
| 9 | Phase 11 | Résultats pilote, support et exploitation stabilisés. |

## 7. Matrice de priorités immédiates

| Priorité | Lot à démarrer | Pourquoi maintenant | Résultat attendu |
|---|---|---|---|
| 1 | Sauvegarde complète et restauration testée | Réduit le risque le plus grave : perte ou récupération incomplète de données. | Reprise démontrée d’une entreprise complète. |
| 2 | Console plateforme P1 : santé, support, fiche entreprise, opérateurs | Donne de vrais outils d’exploitation sans compromettre les clients. | Cockpit exploitable et accès minimal. |
| 3 | Observabilité et procédures d’incident | Évite de découvrir les erreurs par les clients. | Alertes utiles et réaction structurée. |
| 4 | E-mails transactionnels et récupération de compte | Rend les parcours de compte et support crédibles. | Flux de compte autonome et traçable. |
| 5 | Plans, abonnements et paiements | Rend la vente autonome possible. | Inscription → essai → paiement → activation contrôlée. |
| 6 | Consolidation offline et appareil | Protège l’usage terrain différenciant. | Plusieurs jours sans réseau avec reprise fiable. |
| 7 | Conformité et audit externe | Encadre les contrats et renforce la confiance. | Base légale et sécurité défendable. |

## 8. Indicateurs de pilotage du programme

| Domaine | Indicateur de suivi | Cible avant lancement public |
|---|---|---|
| Données | Pourcentage des tables métier couvertes par backup + restore | 100 % des tables et relations critiques. |
| Restauration | Exercices de reprise réussis | Réussite répétable et documentée. |
| Isolation | Scénarios inter-entreprises refusés | Couverture de tous les routeurs sensibles. |
| Offline | Opérations synchronisées sans duplication | Aucune duplication sur scénarios de reprise répétés. |
| Support | Temps de première réponse et délai de résolution | Objectifs définis et suivis par priorité. |
| Production | Taux de sauvegardes échouées, jobs, erreurs et incidents | Alertes responsables et historique exploitable. |
| Commercial | Essais activés, conversions, échecs de paiement, churn | Mesures cohérentes, sans données sensibles inutiles. |
| Qualité | Taux de réussite tests/build/recette | Publication bloquée si les critères critiques échouent. |

## 9. Ce qui ne doit pas être fait

Le programme exclut plusieurs raccourcis dangereux : ajouter un paiement simulé puis l’oublier, activer une souscription depuis le navigateur, rendre la console plateforme capable de lire librement les données client, forcer des suppressions de données pour « réparer » un périmètre, introduire des migrations destructives sans inventaire, stocker des fichiers dans la base, exposer les secrets dans les logs ou donner des droits support permanents sans consentement.

## 10. Prochaine séquence recommandée

La première séquence concrète doit être exécutée dans l’ordre suivant :

1. **Audit de sauvegarde exhaustive**, migration additive si nécessaire, restauration isolée et procédure de reprise.
2. **P1 de la console plateforme** : tableau de santé, fiche entreprise, file support, opérateurs et audit enrichi ; aucune donnée métier client.
3. **Observabilité de production** : sauvegardes, synchronisation, jobs et erreurs.
4. **E-mails transactionnels et récupération de compte**, après choix du fournisseur et configuration sécurisée des secrets.
5. **Offres, souscriptions et paiement SaaS**, seulement après décision marché, prix, fiscalité et prestataire.

Cette séquence produit un progrès visible dans la console tout en traitant d’abord les fondations nécessaires à une commercialisation sûre.

## Références

[1] [Audit de préparation commerciale StockPilot Pro](./AUDIT_PREPRODUCTION_COMMERCIALE.md)  
[2] [Plan du panneau d’administration SaaS](./PLAN_PANNEAU_ADMIN_SAAS.md)  
[3] [Plan de configuration et commercialisation SaaS](./plan-configuration-commercialisation-saas.md)  
[4] [Audit d’isolation multi-entreprise](./tenant-isolation-audit.md)  
[5] [Architecture hors connexion](./offline-architecture.md)
