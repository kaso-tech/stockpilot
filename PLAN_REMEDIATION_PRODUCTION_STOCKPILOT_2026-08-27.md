# Plan de remédiation et d’amélioration pour la production

**Projet :** StockPilot Pro  
**Date :** 27 août 2026  
**Base de travail :** audit global du 27 août 2026  
**Auteur :** Manus AI

## 1. Objet du plan et cible de production

Ce plan transforme les constats de l’audit en une séquence de correction **exécutable, contrôlée et réversible**. L’objectif n’est pas de promettre une absence absolue d’incident — aucune application connectée ne peut l’affirmer honnêtement — mais d’atteindre un niveau de maîtrise permettant d’ouvrir StockPilot Pro à plusieurs entreprises avec des contrôles d’accès, une reprise de données, une exploitation et une qualité de service vérifiables. [1]

> **Cible de sortie :** une production commerciale maîtrisée dans laquelle chaque entreprise est isolée au niveau applicatif et structurel, chaque opération critique est traçable, les sauvegardes sont restaurables, les incidents sont détectés, et les parcours métier essentiels sont validés avant chaque publication.

Le plan respecte les acquis existants : multi-entreprise, multi-entrepôts, rôle plateforme séparé, PWA, POS offline idempotent, journalisation, échéances, dépenses, paie et console SaaS. Il ne prévoit **aucune migration destructive**, aucune réécriture globale sans filets et aucune activation de paiement réel sans fournisseur validé ni secrets fournis par le propriétaire.

| Étape de maturité | Définition | Statut à date |
|---|---|---|
| Pilote accompagné | Quelques entreprises connues, support humain, exploitation surveillée. | Possible sous réserve des contrôles manuels actuels. |
| Production commerciale maîtrisée | Plusieurs entreprises, isolation structurelle, sauvegarde testée, supervision, recette complète et incident response. | Objectif de ce plan. |
| SaaS à grande échelle | Automatisation opérationnelle, paiement, autoscaling maîtrisé, charge et sécurité évaluées formellement. | Étape ultérieure. |

## 2. Règles de mise en œuvre obligatoires

Toutes les corrections suivent une discipline homogène. Chaque lot commence par une liste précise des données touchées, un schéma de migration additive, des tests ciblés et une recette documentée. Chaque lot se termine par `pnpm check`, `pnpm test`, `pnpm build`, une vérification visuelle des parcours concernés, un checkpoint publiable et une note de continuité mise à jour. Les évolutions de données existantes exigent un inventaire, un aperçu et une validation explicite avant toute écriture de masse.

| Règle | Application attendue |
|---|---|
| Multi-entreprise par défaut | Toute lecture, écriture, pièce jointe, export, tâche planifiée et cache est filtré par `companyId`; le dépôt actif s’ajoute lorsque la donnée est localisée. |
| Serveur décisionnaire | Le navigateur ne décide jamais seul d’un droit, d’un abonnement, d’un stock, d’un paiement ou d’un statut d’échéance. |
| Migrations prudentes | Ajout d’abord, inventaire/backfill ensuite, contrainte en dernier. Les suppressions ne sont jamais automatiques. |
| Idempotence | Ventes offline, encaissements, webhooks futurs et traitements planifiés possèdent une clé stable et un journal d’exécution. |
| Données minimales | La console plateforme ne retourne que des métadonnées administratives ; aucun accès direct aux lignes métier client. |
| Traçabilité | Les mutations critiques créent un audit exploitable, associé à une entreprise, à un opérateur et à une date. |
| Sécurité des fichiers | Validation, cloisonnement, URL de lecture limitée dans le temps, rétention et contrôle d’accès sont requis. |

## 3. Vue d’ensemble des lots et dépendances

Les lots peuvent comporter plusieurs tâches en parallèle, mais les portes de sortie doivent rester séquentielles. En particulier, l’ouverture commerciale large ne doit pas être engagée avant la validation des lots A à D.

| Lot | Chantier | Priorité | Dépendances | Porte de sortie |
|---|---|---:|---|---|
| A | Baseline, dépendances et gel de sécurité | Bloquante | Aucune | Aucune vulnérabilité critique/élevée non traitée ou acceptée formellement. |
| B | Isolation structurelle des données | Bloquante | A | Tables critiques contraintes, indexées et contrôlées par entreprise. |
| C | Sauvegarde, restauration et continuité | Bloquante | B | Sauvegarde par entreprise, échec surveillé et restauration témoin validée. |
| D | Authentification, permissions et fichiers | Bloquante | A, B | Matrice de droits et accès fichiers testés. |
| E | Automatisations et supervision | Haute | B, C, D | Jobs observables, isolés, idempotents et alertés. |
| F | Offline-first durable | Haute | B, D, E | Référentiels locaux versionnés et conflits testés. |
| G | Intégrité financière et métier | Haute | B, E | Totaux, stock, paie et échéances cohérents et contrôlés. |
| H | Qualité, accessibilité et recette | Haute | A à G | Scénarios essentiels automatisés et recette multi-appareil validée. |
| I | Facturation SaaS et paiement | Moyenne | D, E, H | Prestataire validé, webhook idempotent et réconciliation active. |
| J | Conformité, exploitation et lancement | Bloquante avant vente publique | A à I selon périmètre | Go/no-go formel, support, incident response et documents de gouvernance actifs. |

## 4. Lot A — Baseline, dépendances et changement contrôlé

L’audit relève une vulnérabilité critique et huit vulnérabilités élevées dans l’arbre de dépendances de production, dont `fast-xml-parser` et une version de Drizzle concernée par un avis d’échappement d’identifiants. Ce lot doit être traité en premier, avant d’élargir l’exposition commerciale. [1] [2]

| Sous-lot | Actions précises | Validation requise |
|---|---|---|
| A1 — Inventaire | Capturer `pnpm-lock.yaml`, versions de runtime, liste d’advisories, dépendances directes/transitives et chemins réellement utilisés. | Rapport de comparaison avant/après, sans secret. |
| A2 — Mise à jour maîtrisée | Mettre à jour les dépendances par famille, relire les notes de version et les incompatibilités ; ne jamais lancer une mise à niveau globale non revue. | Typage, tests, build, PWA, impressions et exports validés après chaque famille. |
| A3 — Validation sécurité | Vérifier les flux XML, import, export, PDF et identifiants de requêtes dynamiques ; conserver les listes blanches de colonnes/tri. | `pnpm audit --prod` sans critique/élevée non justifiée ; note d’acceptation pour les risques résiduels. |
| A4 — Discipline release | Rendre obligatoire la CI sur chaque changement : typecheck, tests, build, audit de dépendances et audit statique de scope. | Pipeline bloquant sur branche principale, artefact de résultat accessible. |

Le résultat attendu est une baseline reproductible : versions verrouillées, vulnérabilités connues évaluées, scripts documentés et capacité de revenir au dernier checkpoint sain. Cette étape ne modifie aucune donnée métier.

## 5. Lot B — Isolation structurelle et intégrité du modèle de données

La protection applicative via `companyScope` est utile, mais des tables importantes acceptent encore un `companyId` nul et certaines unicités sont globales. Le risque principal est la création future de données orphelines, une collision inter-entreprise ou une fuite indirecte par message de conflit. [1] [3]

### B1 — Cartographie de propriété

Construire une matrice table par table : propriétaire direct, parent propriétaire, entrepôt possible, clé métier, données historiques sans propriétaire et stratégie de conservation. Les tables prioritaires sont produits, clients, fournisseurs, ventes, paiements, dépenses, agents, mouvements, inventaires, commandes, sauvegardes, fichiers et journaux.

| Catégorie | Décision structurelle |
|---|---|
| Entité métier racine | `companyId NOT NULL`, index principal et foreign key lorsque le dialecte/le schéma le permet. |
| Entité enfant | Hérite du `companyId` du parent, vérifié en écriture et indexé pour les listes. |
| Donnée localisée | `companyId` obligatoire ; `warehouseId` obligatoire ou explicitement nullable selon la nature consolidée. |
| Paramètre plateforme | Ne contient pas de `companyId`, mais n’expose jamais une donnée métier. |
| Historique ancien sans périmètre | Inventaire puis décision humaine : rattacher avec preuve, archiver dans un espace de quarantaine ou conserver en lecture seule. |

### B2 — Migration progressive et sans perte

La migration suit strictement cinq étapes : (1) ajouter colonnes/indexes si nécessaires, (2) produire un rapport des lignes nulles ou incohérentes, (3) faire valider la règle de rattachement, (4) appliquer des backfills par lots idempotents et auditables, puis (5) seulement après validation, rendre les colonnes obligatoires et ajuster les contraintes uniques. Il ne faut jamais deviner l’entreprise d’une ancienne ligne.

### B3 — Contraintes et tests

Les valeurs métier qui peuvent naturellement exister chez plusieurs clients — références, codes internes, noms de catégories, unités, paramètres ou numéros de document selon la règle retenue — doivent utiliser des contraintes composites comme `(companyId, valeur)`. Les adresses e-mail de connexion peuvent rester globales si l’identité est volontairement unique au niveau plateforme ; cette exception doit être documentée.

> **Gate B :** aucun flux critique ne peut lire, modifier, supprimer, exporter, restaurer ou joindre un fichier à une ressource d’une autre entreprise, y compris par identifiant deviné ou parent indirect.

## 6. Lot C — Sauvegarde, restauration et continuité d’activité

Les sauvegardes locales existent, mais l’audit a constaté une tâche automatique qui traite une configuration associée à une seule entreprise par exécution. Une sauvegarde n’est considérée fiable que si sa couverture, son échec et sa restauration sont démontrés. [1] [4]

| Sous-lot | Actions précises | Résultat vérifiable |
|---|---|---|
| C1 — Orchestration multi-entreprises | Une tâche centrale itère par entreprises actives selon leur politique ; chaque entreprise obtient son propre résultat. | Journal par entreprise : début, succès/échec, durée, taille, référence d’archive. |
| C2 — Manifeste de sauvegarde | Ajouter version de schéma, contenu, checksum, horodatage, périmètre, rétention et état de restauration. | Archive refusée si le manifeste ne correspond pas à son périmètre ou à son checksum. |
| C3 — Réparation isolée | Une entreprise en erreur ne bloque pas le lot ; le job reprend les autres, puis crée une alerte ciblée. | Échec simulé A/B prouvant l’isolation. |
| C4 — Restauration témoin | Restaurer régulièrement une sauvegarde d’une entreprise dans un environnement propre et vérifier le comptage des données. | Procès-verbal de restauration, RPO/RTO mesurés et seuils de succès définis. |
| C5 — Procédure incident | Définir les rôles, décision de restauration, communication client, journal et post-mortem. | Procédure testée lors d’un exercice sans données réelles. |

Les objectifs RPO/RTO doivent être choisis par le propriétaire du produit et documentés avant toute promesse commerciale. À défaut, l’application doit annoncer une sauvegarde « best effort » et non une garantie de reprise.

## 7. Lot D — Authentification, autorisations, stockage et audit

Ce lot renforce les bordures d’accès. Les sessions, la révocation et le fallback e-mail/mot de passe sont déjà présents, mais la recherche actuelle charge des utilisateurs en mémoire ; les fichiers et journaux exigent aussi une vérification complète de l’autorisation réelle. [1] [5]

### D1 — Authentification évolutive

Introduire une colonne `emailNormalized`, l’indexer et requêter un utilisateur unique au lieu de charger l’ensemble de la table. La limite de débit doit migrer vers un stockage partagé avant toute montée en charge à plusieurs instances. Les messages de connexion restent neutres et les sessions doivent être révoquées immédiatement après changement de mot de passe ou désactivation.

### D2 — Matrice d’autorisations

Documenter et tester les droits pour administrateur d’entreprise, responsable d’entrepôt, caissier, vendeur, agent commercial, super administrateur plateforme, opérations, support et facturation. Le client masque les options inutiles ; le serveur refuse systématiquement l’action non autorisée. La console plateforme ne devient jamais un raccourci vers les données opérationnelles d’un client.

### D3 — Fichiers et justificatifs

Les fichiers doivent rester isolés dans le stockage par entreprise et ressource. Toute lecture doit être délivrée par une URL courte ou une autorisation serveurside contrôlée. Ajouter test d’accès croisé, politique de rétention, limite de taille, signature réelle du fichier, journal de téléchargement et procédure de réponse à un fichier suspect. Une analyse antimalware est à introduire si le volume et le risque justifient le service associé.

### D4 — Audit renforcé

Préserver le caractère append-only applicatif, mais créer une protection supplémentaire : privilèges réduits, export d’archives périodiques signées ou stockage à rétention. Les entrées doivent inclure acteur, entreprise, contexte, cible pseudonymisée lorsque nécessaire, action et horodatage UTC ; aucun mot de passe, token ou contenu de document ne doit être journalisé.

## 8. Lot E — Automatisations, santé et supervision

Les rappels et sauvegardes utilisent des tâches planifiées, ce qui est préférable aux minuteries de navigateur. La prochaine étape est de rendre ces tâches observables, paginées et résilientes à une erreur par entreprise. [1] [6]

| Dimension | Amélioration | Critère de sortie |
|---|---|---|
| Planification | Verrou distribué, clé d’idempotence, pagination par entreprise et limite de durée. | Deux déclenchements simultanés ne créent pas de doublon. |
| Isolation des erreurs | `try/catch` par entreprise, état terminal par unité et reprise ciblée. | Une entreprise volontairement en erreur ne bloque pas les autres. |
| Observabilité | Métriques jobs, erreurs applicatives, latence, volume, stockage et base. | Tableau de santé et alerte exploitable sans donnée métier. |
| Journalisation | Logs structurés, corrélation de requête, masquage d’identifiants et rétention. | Les logs permettent le diagnostic sans exposer de secret ou données client. |
| Incident response | Niveaux de gravité, propriétaire d’alerte, délai de prise en charge, post-mortem. | Un exercice de panne est tracé de bout en bout. |

Pour une charge durable ou des tâches longues, vérifier l’adéquation de l’hébergement autoscale avec le volume réel. Toute bascule vers une infrastructure persistante/réservée doit être motivée par les métriques, le coût et un plan de continuité, non par anticipation seule.

## 9. Lot F — Offline-first réellement durable

La file POS offline actuelle est cloisonnée et idempotente. Pour annoncer un travail autonome pendant plusieurs jours, elle doit être complétée par une réplication contrôlée des données de référence et une stratégie de conflit explicite. [1] [7]

| Composant local | Politique cible |
|---|---|
| Catalogue, catégories, unités | Snapshot versionné par entreprise/utilisateur/entrepôt, avec date de fraîcheur et synchronisation différentielle. |
| Clients et adresses | Cache limité à la portée utile, purge à la déconnexion/changement d’entreprise et protection de l’accès local. |
| Tarifs, TVA, rôles de vente | Copie signée/versionnée ; le serveur conserve la décision finale au retour réseau. |
| Stocks | Dernier snapshot par dépôt, distinction visible entre « estimé local » et « confirmé serveur ». |
| Files d’actions | Clé d’opération stable, états explicites, reprise manuelle, journal limité et conservation sans données inutiles. |
| Conflits | Règles documentées : prévention de survente, arbitrage serveur, affichage actionnable et audit de résolution. |

Les tests doivent couvrir la perte réseau pendant vente et paiement, redémarrage du navigateur, changement de compte, changement d’entrepôt, doublons, stockage saturé, migration de version, conflit de stock et suppression contrôlée des caches. Le navigateur ne doit pas exposer les données locales d’une entreprise à une autre après déconnexion.

## 10. Lot G — Intégrité métier, financière et reporting

Les modules de ventes, stock, dépenses, paie, échéances et prévision doivent être vérifiés ensemble afin d’éviter les doubles écritures et les rapports incohérents. La règle centrale est qu’une opération financière réelle dispose d’une source unique, tandis qu’une échéance ou une prévision ne crée pas de dépense comptabilisée avant règlement. [1]

| Flux | Contrôles à consolider |
|---|---|
| Vente et encaissement | Idempotence du document/paiement, total exact, moyen autorisé, stock atomique et audit. |
| Stock | Verrouillage transactionnel/contrôle de disponibilité, transferts au cycle complet et rapprochement mouvement/solde. |
| Dépense et échéance | Une échéance liée crée une dépense seulement à son règlement ; pièces jointes sous périmètre. |
| Salaire et commission | Paiement agent unique, période explicite, ventilation dépôt/agent et absence de double comptage dans la marge. |
| TVA et remise | Valeurs figées dans le document, bornes serveur, droits vendeur et affichage cohérent. |
| Prévision | Séparer engagement, réglé, retard, dépense et salaire ; ne jamais présenter une prévision comme une trésorerie bancaire réelle. |

Ajouter des tests de propriété et de conservation des totaux : une somme de paiements ne dépasse pas l’encaissement, une réception ne dépasse pas le transfert, un règlement n’est pas compté deux fois, et une annulation inverse les effets attendus sans supprimer l’historique.

## 11. Lot H — Qualité, accessibilité et recette de release

Le build et la suite de tests réussissent, mais le script de release actuel ne couvre qu’un nombre réduit de routes et des avertissements React contrôlé/non contrôlé ont été observés. [1] [8]

### H1 — Pyramide de tests

Conserver les tests unitaires de règles pures et ajouter des tests de routeurs pour les permissions, l’isolation, les migrations et les contrôles de fichiers. Ajouter des parcours navigateur pour la connexion, inscription, vente POS, facture, encaissement partiel, changement d’entrepôt, offline/reconnexion, échéances, sauvegarde/restauration, console plateforme et suspension d’entreprise.

### H2 — Contrôle release renforcé

La vérification de release doit contrôler au minimum : typage, test, build, audit dépendances, migration non destructive, absence de données de test sensibles, principaux parcours de revenu, refus inter-entreprise, route plateforme protégée, jobs planifiés enregistrés, bundle PWA et console navigateur sans erreur grave.

### H3 — Accessibilité et expérience

Corriger systématiquement les composants à valeur contrôlée instable. Ajouter une vérification automatisée de contrastes et de règles d’accessibilité, puis une recette manuelle clavier, focus de modal, lecteur d’écran, zoom 200 %, petit écran, thème clair/sombre et saisie lorsque le clavier mobile est ouvert. Les boutons critiques doivent toujours indiquer leur chargement et leur résultat, sans permettre le double clic.

## 12. Lot I — Abonnements, paiement et relation client SaaS

Le socle d’offres et souscriptions est en place, mais aucune collecte de paiement, réconciliation, facture SaaS, relance automatique ou gestion de webhook n’est active. Cette étape nécessite un choix du prestataire et, selon le fournisseur, des informations légales et fiscales du propriétaire. [1]

> **Décision obligatoire avant exécution :** le fournisseur de paiement, les pays/devises supportés, la politique de remboursement, le régime fiscal, les plans définitifs, les limites fonctionnelles et les canaux de support doivent être confirmés par le propriétaire.

| Sous-lot | Exigences minimales |
|---|---|
| Plans et droits | Entités plan/version/limite, période d’essai, suspension, grâce et changement de plan validés côté serveur. |
| Paiement | Création serveur du paiement, références uniques, retour utilisateur séparé de la confirmation réelle, jamais d’activation depuis le client. |
| Webhooks | Signature vérifiée, idempotence, journal brut minimisé, mise en quarantaine et reprise manuelle. |
| Réconciliation | État interne comparé à l’état fournisseur, anomalies détectées, vue opérateur facturation et piste d’audit. |
| Facturation et fiscalité | Numéros, périodes, taxes, avoirs, reçus et exports selon les obligations locales à valider juridiquement. |
| Support | Notifications internes, SLA, escalade, visibilité minimale et accès support temporaire explicitement autorisé/audité. |

Avant paiement réel, utiliser un environnement de test et effectuer des scénarios réussis, annulés, expirés, doublonnés, retardés et reçus dans un ordre inversé.

## 13. Lot J — Conformité, gouvernance et lancement

La production commerciale exige autant de procédures que de code. Les documents existants constituent un point de départ, mais ne remplacent pas une revue juridique adaptée aux pays ciblés et à la nature des données traitées. [1]

| Domaine | Livrable attendu |
|---|---|
| Données personnelles | Inventaire des données, finalités, durées, droits d’accès/rectification/suppression/export et contacts responsables. |
| Contrats | Conditions d’utilisation, politique de confidentialité, accord de traitement/sous-traitance si requis, politique de sécurité et support. |
| Rétention | Politique par type : vente/facture, audit, sauvegarde, fichier, support, trace sécurité et cache offline. |
| Incident | Runbook de détection, qualification, communication, restauration, preuve et post-mortem. |
| Onboarding | Parcours d’inscription, vérification appropriée, création d’entreprise, tutoriel, limites de plan et support initial. |
| Lancement | Liste d’attente/pilote, conditions d’éligibilité, support renforcé, suivi quotidien et mécanisme de rollback. |

La conformité réglementaire doit être validée par un professionnel compétent dans la ou les juridictions de commercialisation. Le produit ne doit pas prétendre à une certification ou une conformité non confirmée.

## 14. Séquence d’exécution proposée

L’ordre suivant réduit le risque tout en préservant la continuité des utilisateurs existants. Chaque lot est découpé en checkpoints publiables ; un lot non validé bloque le suivant si sa porte de sortie concerne la sécurité ou l’intégrité de données.

| Vague | Contenu | Publication | Décision de passage |
|---|---|---|---|
| Vague 1 | A1 à A4 : dépendances et baseline de release. | Checkpoint après chaque famille de dépendances. | Audit sans critique/élevée non maîtrisée. |
| Vague 2 | B1 à B3 : matrice de données, rapport des exceptions et migrations structurelles. | Une migration additive par domaine. | Aucune donnée historique modifiée sans validation explicite. |
| Vague 3 | C1 à C5 : sauvegardes et restauration témoin. | Checkpoint après orchestration puis après exercice. | RPO/RTO et couverture confirmés. |
| Vague 4 | D1 à D4 : auth scalable, autorisations, fichiers et audit. | Checkpoint par sous-domaine. | Matrice de droits et tests d’accès croisé verts. |
| Vague 5 | E1 à E5 et F : opérations observables et offline durable. | Checkpoint par composant de synchronisation/job. | Pannes, reprises et changement de périmètre testés. |
| Vague 6 | G et H : intégrité métier, UX, accessibilité et recette. | Checkpoint après les scénarios de revenu. | Aucun défaut bloquant dans la recette de release. |
| Vague 7 | I et J : paiement, conformité et lancement progressif. | Aucun paiement réel avant feu vert. | Go/no-go formel du propriétaire et des responsables métier/juridiques. |

## 15. Tableau de bord de pilotage de la remédiation

Créer dans la console plateforme une vue **Santé de la production** sans donnée métier cliente. Elle doit donner au propriétaire la preuve que le plan avance et signaler les risques opérationnels.

| Indicateur | Seuil d’alerte | Responsable initial |
|---|---|---|
| Dépendances critiques/élevées | Toute valeur non acceptée formellement. | Responsable technique. |
| Tables métier sans `companyId NOT NULL` | Toute table critique non migrée. | Responsable données. |
| Sauvegarde réussie par entreprise | Aucune sauvegarde récente ou erreur non traitée. | Responsable exploitation. |
| Restauration témoin | Dernier exercice trop ancien selon politique. | Responsable exploitation. |
| Jobs planifiés | Retard, erreur répétée ou durée anormale. | Responsable exploitation. |
| Erreurs applicatives | Pic ou erreur critique non acquittée. | Responsable technique. |
| Régressions de release | Échec test/build/recette. | Responsable qualité. |
| Reconnexions offline en erreur | Hausse ou conflit non résolu. | Responsable produit/terrain. |

## 16. Critères go/no-go avant ouverture commerciale large

| Critère | Exigence de lancement |
|---|---|
| Dépendances | Aucune vulnérabilité critique ou élevée non corrigée/acceptée avec justification et plan. |
| Données | Toutes les tables critiques ont une propriété entreprise vérifiable ; les exceptions historiques sont documentées. |
| Sauvegarde | Sauvegarde automatisée par entreprise, alertes d’échec et restauration témoin réussie. |
| Sécurité | Test d’intrusion ou revue indépendante ciblée réalisée ; accès fichiers et plateforme validés. |
| Offline | Promesse commerciale limitée aux capacités effectivement testées ; cache durable livré avant promesse multi-jours. |
| Qualité | CI bloquante, parcours critiques automatisés, aucun avertissement/erreur grave récurrent dans les journaux. |
| Exploitation | Supervision, alertes, contact incident, procédure d’escalade et rollback disponibles. |
| SaaS | Si paiement activé : webhook, réconciliation, support et conformité validés. |
| Gouvernance | Conditions, politique de confidentialité, rétention et responsabilités relues par les parties compétentes. |

## 17. Règles de décision et points nécessitant votre validation

Certaines décisions sont techniques et peuvent être exécutées progressivement. D’autres sont irréversibles ou réglementaires et exigent votre validation avant mise en œuvre : rattachement de données historiques sans entreprise, suppression/archivage de lignes orphelines, objectifs RPO/RTO, plan de rétention des archives/fichiers, prestataire de paiement, prix/monnaies, fiscalité, remboursement, juridictions de vente et politique d’incident.

Le prochain lot recommandé est **A — dépendances et baseline sécurisée**, suivi immédiatement de **B — isolation structurelle**. Cette séquence corrige d’abord l’exposition logicielle connue puis sécurise les fondations de données, avant d’ajouter de nouvelles fonctionnalités commerciales.

## Références

[1]: ./AUDIT_GLOBAL_STOCKPILOT_2026-08-27.md "Audit global de StockPilot Pro — 27 août 2026"
[2]: https://github.com/advisories/GHSA-gpj5-g38j-94v9 "GitHub Security Advisory — Drizzle ORM"
[3]: ./server/companyScope.ts "Garde-fou applicatif d’isolation par entreprise"
[4]: ./server/scheduledBackups.ts "Sauvegardes planifiées par entreprise"
[5]: ./server/routers.ts "Authentification locale, sessions et inscription"
[6]: ./server/scheduledPaymentDueReminders.ts "Rappels d’échéance planifiés"
[7]: ./client/src/contexts/OfflineContext.tsx "File IndexedDB et synchronisation hors connexion"
[8]: ./scripts/verify-release.mjs "Contrôles de release actuels"
