# Audit global de StockPilot Pro

**Date :** 27 août 2026  
**Périmètre :** code applicatif, schéma de données, migrations, automatisations, PWA/offline, contrôles qualité, interface et préparation de production.  
**Version auditée :** checkpoint `cc09a846`, avec uniquement l’entrée de suivi de cet audit non publiée au moment de l’examen.  
**Auteur :** Manus AI

## Conclusion exécutive

StockPilot Pro possède aujourd’hui une base produit nettement plus mature qu’un prototype : gestion de stock multi-entrepôts, ventes, POS, devis/factures, dépenses, agents, échéances, PWA, journalisation, administration SaaS et contrôle des rôles sont présents. Les contrôles de typage, la suite de tests et le build de production réussissent. Les flux hors connexion pour les ventes sont également mieux structurés que dans une application web classique, grâce au cloisonnement par utilisateur/entreprise et à l’idempotence côté serveur. [3] [5]

> **Verdict : l’application est adaptée à un pilote commercial accompagné, mais elle ne doit pas encore être considérée comme un SaaS autonome à grande échelle.**

Deux sujets conditionnent la montée en production commerciale : la mise à jour urgente des dépendances vulnérables et le renforcement structurel de l’isolation en base de données. S’y ajoutent la couverture incomplète des sauvegardes automatiques multi-entreprises, une expérience offline encore partielle pour plusieurs jours d’utilisation, et l’absence de supervision opérationnelle continue.

| Évaluation | Résultat |
|---|---|
| Produit métier | **Solide pour un pilote** : les principaux flux stock, vente, facturation, dépense, paie et entrepôt existent. |
| Isolation applicative | **Bonne mais non suffisante seule** : l’usage de `companyScope` est étendu, mais des protections structurelles en base manquent. |
| Authentification | **Fonctionnelle** : sessions, révocation, mots de passe hachés et limites de saisie existent ; quelques requêtes doivent être rendues indexées et plus scalables. |
| Offline/PWA | **Partiel et prometteur** : file de ventes cloisonnée et idempotente, sans réplication durable complète du catalogue et des données nécessaires au travail prolongé. |
| Exploitation | **À consolider** : tâches planifiées actives, mais supervision, alerting, reprise et sauvegarde globale restent insuffisants. |
| Dépendances | **Non acceptable en l’état pour une production ouverte** : 1 vulnérabilité critique et 8 élevées dans l’arbre de production. |
| UX/accessibilité | **Cohérente mais à stabiliser** : rendu professionnel observé, avec avertissements React récurrents sur certains sélecteurs. |

## Méthode et limites

L’examen a porté sur le schéma Drizzle et les migrations, les routeurs tRPC sensibles, les règles de périmètre entreprise et entrepôt, les sessions, les tâches planifiées, la file IndexedDB, les scripts de qualité, les journaux de développement et un échantillon visuel des écrans principaux. Les commandes `pnpm check`, `pnpm test`, `pnpm build` et `pnpm verify:release` ont réussi dans l’environnement de projet. La suite contient **252 tests** répartis dans **106 fichiers de tests** pour 349 fichiers TypeScript/TSX inventoriés.

Cet audit n’est **ni un test d’intrusion**, ni un audit de l’infrastructure de l’hébergeur, du pare-feu, des permissions réelles du stockage objet, des comptes de messagerie ou du navigateur de chaque utilisateur. Aucun test de charge, aucune restauration complète sur environnement isolé et aucun contrôle juridique formel n’ont été réalisés. Ces limites sont elles-mêmes des actions à prévoir avant une commercialisation large.

## Points solides constatés

Le projet applique de nombreuses pratiques pertinentes. Les procédures métier utilisent majoritairement `protectedProcedure`, et le middleware bloque les entreprises suspendues avant les flux ordinaires. Les routeurs plateforme sont séparés et les réponses de la console ne sont pas censées contenir de lignes de ventes, stocks, clients ou documents métier. [3] [4]

La file offline est isolée par `companyId` et par utilisateur, migre l’ancien stockage vers IndexedDB, conserve un journal local limité, utilise une synchronisation à exécution unique et rejoue les ventes avec des identifiants d’opération idempotents. Le serveur traite séparément l’idempotence de la création du document et de l’encaissement, ce qui réduit fortement le risque de double vente lors d’une reconnexion instable. [5] [10]

Les limites numériques, les validateurs Zod, les contrôles de rôles d’entrepôt, les validations de fichiers et les journaux d’audit sont présents dans les flux examinés. Les dernières évolutions ont également évité les migrations destructives, ce qui est particulièrement important compte tenu de l’historique de données utilisateur. Les tâches de sauvegarde et de rappel existent et sont authentifiées comme tâches planifiées plutôt que déclenchées par un simple minuteur client. [6] [7]

## Constats prioritaires

| ID | Niveau | Constat vérifié | Impact possible | Action recommandée |
|---|---|---|---|---|
| S-01 | **Critique** | `pnpm audit --prod` remonte **1 alerte critique**, **8 élevées**, 32 modérées et 9 faibles. L’alerte critique concerne `fast-xml-parser` et nécessite au minimum la version 5.3.5 ; la version actuelle de Drizzle est aussi concernée par un avis élevé sur l’échappement d’identifiants, corrigé à partir de 0.45.2. [1] [2] | Exposition aux vulnérabilités publiées de la chaîne d’exécution, même si leur exploitabilité dépend du chemin applicatif réel. | Mettre à jour les dépendances directes et transitives dans une branche dédiée, examiner les changements majeurs, puis exécuter typage, tests, build et contrôle des flux XML/PDF/exports avant publication. |
| T-01 | **Élevé** | La base accepte encore `companyId` nul sur au moins 20 tables métier ou opérationnelles, dont produits, clients, ventes, dépenses, agents, mouvements et sauvegardes. L’isolation repose donc principalement sur le code applicatif. | Une future requête omettant son filtre ou un import défaillant peut produire des lignes orphelines ou globales difficiles à détecter. | Réaliser une migration progressive : inventaire des lignes nulles, rattachement explicite ou archivage, contraintes `NOT NULL`, clés étrangères et indexes composites `(companyId, …)` là où le métier le permet. Ne pas appliquer automatiquement sur les données existantes. |
| O-01 | **Élevé** | Une seule tâche de sauvegarde automatique active a été observée. Son endpoint traite une configuration associée à un seul `companyId` à chaque exécution. [6] | Les nouvelles entreprises peuvent ne pas disposer d’une sauvegarde automatique effectivement exécutée ; la capacité de restauration globale n’est pas démontrée. | Créer une orchestration centrale qui itère par entreprise active, journalise succès/échec par entreprise, alerte sur les échecs et impose un test de restauration périodique. |
| A-01 | **Élevé** | La connexion par e-mail charge l’ensemble des utilisateurs en mémoire puis recherche l’adresse côté application. L’inscription et la vérification de disponibilité font de même. [4] | Coût qui croît avec le nombre d’entreprises/utilisateurs, risque de saturation et surface mémoire inutile lors d’attaques par tentatives de connexion. | Ajouter un e-mail normalisé/indexé, interroger avec une sélection limitée, conserver les limites de débit et prévoir un rate-limit partagé avant la montée en charge. |
| O-02 | **Moyen** | La tâche de rappels parcourt séquentiellement tous les échéanciers actifs. Une erreur de données ou une erreur sur une entreprise peut faire échouer le lot entier, avec reprise au cycle suivant seulement. [7] | Retard de rappels et baisse de fiabilité lorsque la base et le volume d’échéances augmentent. | Introduire traitement par lots, verrou distribué, métriques de durée, journal par entreprise et isolation des erreurs pour qu’une entreprise fautive ne bloque pas les autres. |
| T-02 | **Moyen** | Plusieurs identifiants ou références sont globalement uniques dans le schéma alors que l’application vise le multi-entreprise. Le contrôle des contraintes ne repose pas toujours sur `(companyId, valeur)`. | Refus de création pour une donnée légitime déjà utilisée par une autre entreprise, ou fuite indirecte de l’existence d’une valeur par un message de conflit. | Réviser table par table les références métier, noms de catégories/unités et codes. Remplacer les unicités globales non nécessaires par des contraintes composites tenant-aware. |
| F-01 | **Moyen** | Les journaux d’audit applicatifs sont append-only par convention applicative, pas protégés par une stratégie d’immutabilité indépendante ou une séparation de privilèges. | Un compte ou un bug disposant de l’accès base peut altérer l’historique, ce qui limite sa valeur de preuve. | Interdire les mutations applicatives des journaux, séparer les privilèges, exporter périodiquement les traces signées ou écrire dans un stockage d’archivage à rétention. |
| P-01 | **Moyen** | Le mode offline protège la file de ventes, mais il ne met pas en évidence une réplication durable complète du catalogue, des clients, des règles tarifaires, des paramètres TVA et des stocks par entrepôt. [5] | Utilisation hors connexion plusieurs jours limitée ou incohérente si les données nécessaires ne sont pas déjà présentes dans le cache navigateur. | Concevoir un cache IndexedDB versionné par entreprise/utilisateur/entrepôt pour les données de référence et les snapshots de stock, avec stratégie de conflit, indicateur de fraîcheur et purge au changement de compte. |
| Q-01 | **Moyen** | Les journaux navigateur signalent à répétition des sélecteurs React basculant entre états contrôlé et non contrôlé. | Comportements de formulaire imprévisibles, bruit de diagnostic et risque de perte de saisie sur certaines pages. | Localiser les composants concernés à partir des écrans de création/édition, initialiser chaque valeur à un type stable et ajouter un test de rendu ciblé. |
| Q-02 | **Moyen** | Le script `verify:release` vérifie seulement la racine publique et deux routes protégées. [8] | Une publication peut réussir malgré une régression sur auth, droits d’entrepôt, isolation, paiements, offline ou routes plateforme. | Étendre la recette automatisée : parcours de connexion, création/encaissement, absence de fuite inter-entreprise, flux PWA, contrôles d’upload, console plateforme et tâches planifiées. |
| S-02 | **Moyen** | Les pièces jointes sont validées par type/taille et rangées par périmètre, mais la chaîne complète de téléchargement autorisé, expiration/révocation, analyse antimalware et conservation n’a pas été testée ici. | Exposition d’un justificatif ou d’une capture si une URL de stockage est durablement réutilisable ou si un fichier malveillant est téléchargé. | Vérifier les ACL réelles, préférer URLs présignées courtes pour la lecture, ajouter une analyse de fichiers selon le volume, fixer une politique de rétention et tester accès croisés. |
| B-01 | **Moyen** | Le socle abonnements est administrable, mais paiement, webhook, réconciliation, facture SaaS, taxe et relance automatique ne sont pas activés. | Les ventes d’abonnements ne peuvent pas être automatisées de façon fiable ; le suivi administratif reste manuel. | Choisir un fournisseur, définir plans/droits/quotas, préparer idempotence webhook, journal de réconciliation et environnement de test avant tout encaissement réel. |
| U-01 | **Faible à moyen** | L’interface est cohérente, sombre, professionnelle et adaptée aux écrans inspectés, mais reste visuellement générique et les vérifications d’accessibilité automatisées ne sont pas intégrées. | Moindre différenciation commerciale et risques non détectés de clavier, focus, lecteur d’écran ou contraste sur les états rares. | Définir une charte StockPilot, intégrer audits automatisés d’accessibilité, vérifier le clavier, les modales et les contrastes clair/sombre à chaque publication. |
| O-03 | **Faible à moyen** | Il n’existe pas de preuve d’une supervision centralisée de disponibilité, erreurs, performance, saturation base, job retardé ou capacité de stockage. | Détection tardive des incidents et support plus coûteux à mesure que le nombre de clients augmente. | Mettre en place métriques, logs structurés sans données sensibles, alerting, tableau de santé, rotation/rétention et procédure d’incident. |

## Incohérences et correctifs de conception à traiter

L’application porte deux objectifs qui ne sont pas encore totalement alignés : une exploitation commerciale multi-entreprise et une persistance historique provenant d’un projet initialement moins strict sur les clés de périmètre. La présence de `companyScope` dans les routeurs est une protection utile, mais elle doit devenir une seconde barrière, non la seule. Les clés de propriété, contraintes de nullité, foreign keys et indexes composés doivent porter la même logique dans la base.

Le statut « prêt hors connexion » doit également être précisé dans les documents commerciaux. Le produit supporte aujourd’hui une **file de transactions offline avec reprise**, ce qui est une capacité importante. Il ne démontre pas encore un fonctionnement pleinement autonome pendant plusieurs jours avec un catalogue, une liste de clients, des tarifs, des autorisations et des stocks locaux toujours fiables. Cette distinction est essentielle pour éviter une promesse commerciale excessive.

Enfin, les sauvegardes existent mais une sauvegarde sans exercice de restauration ni couverture vérifiée de chaque entreprise ne constitue pas un plan de continuité complet. La sauvegarde doit être suivie de tests de restauration, d’objectifs RPO/RTO écrits et d’un signalement automatique des échecs.

## Feuille de route recommandée

### Palier 0 — Bloquants avant ouverture commerciale large

| Priorité | Action | Critère de sortie |
|---|---|---|
| P0.1 | Mettre à jour et vérifier les vulnérabilités critiques/élevées du graphe de dépendances. | `pnpm audit --prod` ne remonte plus d’alerte critique/élevée non acceptée formellement. |
| P0.2 | Concevoir la migration de non-nullité, clés étrangères et unicités multi-entreprises. | Inventaire des exceptions validé, migration testée sur copie et plan de retour documenté. |
| P0.3 | Corriger la couverture de sauvegarde multi-entreprises et exécuter une restauration témoin. | Chaque entreprise active a une sauvegarde récente et une restauration contrôlée est réussie. |
| P0.4 | Corriger les avertissements contrôlé/non contrôlé des formulaires. | Journaux navigateur sans avertissement React récurrent sur les parcours audités. |

### Palier 1 — Fiabilité opérationnelle

Ce palier doit ajouter une supervision de disponibilité, base, stockage et tâches planifiées ; des alertes d’échec de sauvegarde/synchronisation ; des journaux structurés anonymisés ; une recette automatisée enrichie ; et la séparation des journaux d’audit critiques. Il doit aussi transformer le traitement global des rappels en traitement paginé, isolé par entreprise et observable.

| Chantiers | Résultat attendu |
|---|---|
| Authentification scalable | Recherche indexée par e-mail normalisé, anti-bruteforce partagé, rotation documentée des secrets et procédures de récupération. |
| Contrats d’accès | Matrice de permissions testée pour administrateur, responsable, caissier, vendeur, agent et opérateur plateforme. |
| Fichiers | Lecture autorisée et expirante, validation renforcée, audit de téléchargement, rétention et réponse aux fichiers suspects. |
| Qualité | E2E des flux de revenu, sauvegarde/restauration, offline, multi-entrepôts et suspension d’entreprise. |

### Palier 2 — Offline réellement durable et expérience terrain

Le chantier offline doit couvrir les données de référence nécessaires à la vente, avec un stockage versionné par entreprise/utilisateur/entrepôt, une date de dernier rafraîchissement, une limite de stockage, une migration de version, une purge lors de déconnexion et un protocole de résolution de conflit de stock contrôlé. Les ventes doivent rester idempotentes ; aucune logique de stock ne doit faire confiance au navigateur pour l’arbitrage final.

### Palier 3 — Commercialisation SaaS automatisée

Avant l’encaissement d’abonnements, définir les plans, limites, période d’essai, suspension, remboursement, facturation, fiscalité, support, réconciliation, incidents de webhook et exploitation manuelle de secours. L’intégration d’un paiement ne doit démarrer qu’après le choix d’un fournisseur et des informations juridiques/financières nécessaires. Aucun secret de paiement ne doit être inséré dans le code ni dans le dépôt.

### Palier 4 — Conformité et gouvernance

Ce palier doit préciser politiques de conservation/suppression des données et fichiers, procédure d’export client, registre de traitements, conditions contractuelles, politique de sécurité, processus d’incident, gestion des sous-traitants, consentements applicables et responsabilités support. Une revue juridique locale est requise avant d’affirmer une conformité réglementaire.

## Tests à ajouter en priorité

| Domaine | Cas indispensable |
|---|---|
| Isolation | Deux entreprises créent la même référence métier ; absence d’accès lecture/modification/fichier entre elles ; données sans `companyId` rejetées. |
| Sauvegarde | Une exécution couvre plusieurs entreprises, une panne d’entreprise n’interrompt pas les autres, restauration dans un environnement propre. |
| Auth | Recherche utilisateur indexée, limite de débit multi-instance, révocation immédiate et changement de mot de passe. |
| Offline | Création puis encaissement rejoués après panne réseau, multi-paiement, changement d’utilisateur/entreprise, conflit de stock et purge contrôlée. |
| Plateforme | Chaque rôle ne voit et n’exécute que ses actions ; aucune réponse ne contient de données métier d’entreprise. |
| Fichiers | Rejet de type/poids/signature non conforme, URL expirée, accès croisé refusé, suppression/rétention conforme. |
| Accessibilité | Navigation clavier, focus des modales, lecteur d’écran, zoom 200 %, contrastes clair/sombre et formulaires sans avertissement React. |

## Décision de mise en production

| Scénario | Décision conseillée | Conditions |
|---|---|---|
| Pilote avec quelques entreprises connues | **Possible avec accompagnement** | Sauvegardes surveillées, accès plateforme limité, support humain, règles de confidentialité explicites et traitement rapide des P0. |
| Vente publique à de nombreuses entreprises | **À différer** | Terminer P0.1 à P0.3, réaliser tests de charge/pentest, déployer supervision et exercice de restauration. |
| Paiement SaaS automatisé | **À différer** | Prestataire choisi, webhooks idempotents, réconciliation, support paiement et conformité validés. |
| Promesse d’offline plusieurs jours | **À formuler prudemment** | Livrer le cache complet de données de référence et les tests de conflit terrain. |

## Références

[1]: ./package.json "Versions et scripts du projet"
[2]: https://github.com/advisories/GHSA-gpj5-g38j-94v9 "Avis GitHub Security Advisory relatif à Drizzle ORM"
[3]: ./server/_core/trpc.ts "Procédures authentifiées et suspension d’entreprise"
[4]: ./server/routers.ts "Authentification locale, sessions et inscription"
[5]: ./client/src/contexts/OfflineContext.tsx "File IndexedDB et synchronisation hors connexion"
[6]: ./server/scheduledBackups.ts "Exécution des sauvegardes planifiées"
[7]: ./server/scheduledPaymentDueReminders.ts "Exécution des rappels d’échéance"
[8]: ./scripts/verify-release.mjs "Contrôles de release actuels"
[9]: ./vite.config.ts "Configuration PWA et collecte de journaux de développement"
[10]: ./server/routers/transactions.ts "Transactions, contrôles métier et idempotence offline"
