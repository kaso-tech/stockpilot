# StockPilot Pro — Intégration des nouveautés GitHub de novembre

**Date :** 12 novembre 2026
**Source examinée :** `kaso-tech/stockpilot`, branche `ccr-1f2b32f0-8cxy1l`, commit `ef4ac6d793228475c3ce64653f96134af95328f1`
**Socle préservé :** checkpoint `abc48e5e` ; correction d’installation préalable `4cc686f9`
**Méthode :** portage sélectif sur le projet existant. Les essais de fusion/rebase ont été annulés ; aucune restauration de l’ancienne branche `main` GitHub n’a été effectuée.

## Nouveautés intégrées

| Domaine | Contenu livré |
|---|---|
| Authentification | Récupération de mot de passe par jeton aléatoire haché, expirant et à usage unique ; révocation des sessions après réinitialisation. Vérification e-mail facultative, liée à l’adresse courante et sans bloquer les comptes existants. |
| Partage | Envoi serveur de documents PDF aux coordonnées du client ou fournisseur rattaché, avec validation du fichier et des en-têtes, limites de débit et audit tenant-scopé. Le partage précédent et les actions hors réseau ne sont pas remplacés. |
| Retours | Retours partiels par ligne, historique d’avoirs numérotés par entreprise/année, clé idempotente, conservation des arrondis et écritures de stock/encaissement dans une transaction. |
| TVA | Taux propre au produit, taux et montant figés par ligne ; ventilation commune aux calculs client/offline et serveur, avec remise globale répartie exactement. |
| Catalogue | Références de catégories et d’unités par identifiant, unicités par entreprise, protection des références utilisées et maintien des libellés historiques. |
| Rôles | Administrateur, gérant, vendeur, comptable et lecteur ; permissions serveur et navigation adaptées. Les affectations et rôles d’entrepôt existants restent appliqués. Le propriétaire, le dernier administrateur et l’auto-modification de rôle sont protégés. |
| Caisse/comptabilité | Page de suivi, exports et clôtures journalières par entreprise/entrepôt ; journée métier déterminée selon le fuseau configuré. Une clôture est enregistrée de manière immuable. |
| Lots | Numéro de lot et péremption à la réception, vue des lots, allocation FEFO et données de lots/coûts conservées dans les transferts ; coût moyen pondéré par stock d’entrepôt. |
| SaaS | Consommation utilisateurs/produits/entrepôts, limites explicites des offres et export tenant-scopé. La création soumise à quota verrouille l’entreprise dans la transaction appelante. Les limites absentes ne bloquent pas rétroactivement les clients existants. |
| Stockage | Pilote S3 optionnel en conservant le pilote Manus par défaut et les contrôles de fichiers existants. |
| PWA/qualité | Chargement des pages à la demande, précache PWA des fichiers nécessaires, recette Playwright intégrée à la CI et confirmation personnalisée avant activation d’une mise à jour. |

## Protection du fonctionnement existant

L’intégration ne supprime aucune table ni donnée métier, ne change aucun rôle existant et ne réactive pas l’ancienne authentification Google. Les périmètres de cache et de file offline restent séparés par entreprise, utilisateur et entrepôt. Les nouvelles lectures de dashboard non administrateur sont limitées à un entrepôt autorisé.

Une notification « Une nouvelle version est prête » peut être reportée. L’application n’active la mise à jour qu’après une seconde confirmation. La modale rappelle le risque de perte des saisies **non enregistrées**, affiche les opérations en attente et bloque l’activation si le stockage local a signalé une erreur.

## Migrations

Les migrations `0077_dusty_scream.sql` et `0078_november_compatibility_backfill.sql` ont été générées, revues et appliquées à la base attachée. L’extension de l’enum des rôles conserve les valeurs existantes. Les unicités globales de noms de catégories et d’unités sont remplacées par des unicités d’entreprise, sans suppression de lignes.

La reprise remplit les références de catalogue à partir des noms de la même entreprise, initialise le coût moyen à partir du coût historique du produit et fige la TVA globale historique sur les anciennes lignes taxées. Aucun total de facture, paiement ou quantité de stock n’est modifié par cette reprise. Les colonnes et nouvelles tables ont été contrôlées après application.

**Pour une base déjà existante :** ne pas rejouer toutes les migrations historiques ni la reprise 0078 après de nouvelles opérations métier. Vérifier les migrations déjà appliquées et sauvegarder la base avant toute migration supplémentaire. L’archive source n’est pas une sauvegarde des données MySQL ni des files locales des appareils.

## Recette exécutée sur cette livraison

| Contrôle | Résultat |
|---|---|
| `pnpm check` | Réussi |
| `pnpm test` | 129 fichiers, 332 tests réussis |
| `pnpm build` | Réussi ; 121 entrées précachées |
| `pnpm verify:release` | Réussi, audit production sans vulnérabilité connue détectée |
| `pnpm install --frozen-lockfile --prefer-offline` | Réussi |
| `pnpm test:e2e` | 5 scénarios réussis sur le build de production, API simulée et `DATABASE_URL` vide |
| `git diff --check` | Réussi |

Les scénarios navigateur couvrent la connexion et la récupération, la navigation interne sans nouveau document, les pages déjà chargées après coupure réseau réelle, le report/consentement PWA et le blocage d’une route de création pour le lecteur. Ils ne prouvent pas une connexion SMTP/S3 réelle, une recette comptable réglementaire ou plusieurs jours d’utilisation sur tous les appareils.

Le découpage réduit le bundle initial par rapport à la version monolithique précédente. Quelques chunks dépassent encore 500 kB : cet avertissement n’empêche pas le build et reste un point d’optimisation.

## Services et conditions restant à configurer ou valider

- **YengaPay reste explicitement en pause SANDBOX.** Aucun appel PayIn, checkout, paiement ou activation d’abonnement n’a été exécuté pendant cette intégration. Ne pas activer `YENGAPAY_PAYIN_ENABLED` sans la validation technique et l’accord déjà prévus.
- L’envoi e-mail réel exige `SMTP_URL`, `MAIL_FROM` et, pour les liens de compte, `PUBLIC_APP_URL` HTTPS de confiance. Aucun identifiant SMTP n’a été ajouté et aucune délivrance réelle n’est revendiquée. Le transport mémoire est limité aux tests.
- Le pilote S3 externe reste optionnel : son endpoint, bucket, région et secrets doivent être configurés puis testés avant toute bascule. Aucun objet existant n’a été déplacé ; Manus reste le pilote de repli.
- Le suivi de péremption et FEFO ne constitue pas une certification de traçabilité sanitaire ni une règle réglementaire universelle d’interdiction de vente. Les stocks historiques sans lots ne sont pas transformés artificiellement en lots fournisseur.
- Les clôtures et exports doivent être rapprochés avec la caisse réelle et revus selon la comptabilité applicable. Une clôture n’est pas, à elle seule, une certification de logiciel de caisse.
- L’usage offline repose sur les données disponibles localement et l’espace persistant accordé par le navigateur. Les actions serveur telles que récupération, envoi e-mail, clôture et retour confirmé ne sont pas promises hors réseau.

La livraison est une version intégrée et testée pour le pilote encadré. Elle ne clôture ni le lot I YengaPay ni les validations externes de sécurité, restauration témoin, support, rétention et conformité du registre de lancement.
