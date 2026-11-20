# StockPilot Pro — Livraison synchronisée du 13 novembre 2026

## Source et méthode

La branche de collaboration `ccr-1f2b32f0-8cxy1l` de `kaso-tech/stockpilot` a été récupérée dans `github/november-latest`. Sa tête figée est `726b79f48d766a2ebb34c16a8f518c24bfd18de7`, datée du 13 novembre à 05:18 UTC. Elle ajoute le thème (`1c60472`) et les photos produit (`726b79f`) depuis la source `ef4ac6d` intégrée la veille.

Le pull de `main` sur le remote interne n’a pas abouti : l’accès nécessaire à ce remote n’est pas disponible dans ce terminal. Le `main` GitHub public au compte connecté reste une ancienne base du 24 août. Une fusion ou un cherry-pick global des nouveaux commits écraserait ou mettrait en conflit les travaux déjà intégrés. La livraison repose donc sur un **portage sélectif des nouveautés sur le checkpoint 798b3429**, et non sur une copie brute de la branche distante. La référence de sauvegarde est `backup/pre-pull-2026-11-13` ; la branche de travail est `integrate/github-latest-2026-11-13`.

Aucun push vers GitHub, remplacement de l’historique partagé ni restauration d’une ancienne version n’a été effectué.

## Contenu livré

| Domaine | Intégration et garanties préservées |
|---|---|
| Apparence | Surfaces ardoise claires/sombres, jetons sémantiques, composants et pages harmonisés, Inter et chiffres alignés. Le bleu par défaut `#2563EB` et la personnalisation sont conservés plutôt que remplacés par le pétrole de la source. |
| Navigation | Sidebar et header harmonisés ; recherche de pages via bouton ou Ctrl/Cmd+K. Seules les routes autorisées au rôle apparaissent ; sélection en navigation SPA. |
| Tableau de bord | Petits ajouts de la source : nombre de ventes du jour, créances et nombre de factures à encaisser, métadonnées de ventes récentes. Les factures annulées/remboursées sont exclues des créances. La portée entreprise/entrepôt et les restrictions de lecture financière sont conservées. Les cartes et préférences actuelles ne sont pas remplacées en bloc. |
| Photos produit | Ajout à la création, remplacement et retrait sur la fiche/formulaire. Miniatures du catalogue ; photos de la caisse avec bouton d’affichage. Compression avant envoi ; prise de photo mobile sur les fiches. Les traitements stock, tarifs, TVA et encaissement ne sont pas remplacés. |
| Sécurité photo | Formats raster contrôlés par signature et limites de 600 Kio/120 Kio, validation serveur, permission `catalog.manage`, portée entreprise et verrou transactionnel au remplacement. Audit dans la même transaction que les pointeurs. Aucun BLOB en base. |
| Relais privé | Session obligatoire, appartenance entreprise et rattachement exact de la photo au produit vérifiés avant lecture. Une photo remplacée/détachée n’est plus servie même si ses octets sont conservés par le fournisseur. Aucune URL signée n’est rendue au client pour ces photos. |
| Offline/PWA | Cache photo séparé par entreprise/utilisateur/entrepôt, relu lors d’une coupure réseau et purgé à la déconnexion ; les fichiers API sont exclus du fallback de navigation. Les mises à jour PWA restent reportables et soumises à confirmation explicite. |
| Sauvegardes | Les archives historiques sans pointeur photo restent valides. Les nouveaux pointeurs sont contrôlés contre l’entreprise et le produit du snapshot. Les photos partagent le catalogue maître de l’entreprise, pas les quantités des différents dépôts. |

## Migration

La migration générée `0079_product_images.sql` ajoute uniquement les colonnes nullable `products.imageUrl` et `products.imageThumbUrl` (`varchar(512)`). Les deux instructions ont été revues et appliquées à la base attachée. Aucun produit, quantité, prix, paiement ou rôle existant n’a été modifié par cette migration.

Ne pas importer la migration photo `0055` de la branche GitHub : ce numéro existe déjà dans l’historique de cette application. Ne pas rejouer toute la chaîne de migrations sur une base déjà migrée. Pour un autre environnement, vérifier l’état du schéma et effectuer la sauvegarde habituelle avant l’application de 0079.

## Preuves de recette

| Contrôle | Résultat |
|---|---|
| TypeScript | `pnpm exec tsc --noEmit --incremental false` réussi. Le cache incrémental du watcher conservait des diagnostics d’une ancienne branche ; il ne remplace pas ce contrôle frais. |
| Tests | 135 fichiers / 354 tests Vitest réussis, dont validation photo, permissions tenant, remplacement concurrent, cache offline et refus du relais sur photos détachées. |
| Build PWA | Réussi ; 123 entrées précachées. L’avertissement de chunks supérieurs à 500 kB reste non bloquant. |
| Audit et release | `pnpm verify:release` réussi, incluant audit production et refus du stockage non authentifié et du webhook YengaPay non signé. |
| Navigateur | 7 scénarios Playwright réussis sur build production et API simulée, sans base métier : connexion, navigation sans nouveau document, coupure réseau, confirmation PWA, rôles, photos offline/purge et recherche/thèmes. |
| Diff | `git diff --check` réussi. |

L’échec initial du scénario photo provenait d’un PNG synthétique accepté par le décodage tolérant mais invalide pour `createImageBitmap`. La fixture a été réencodée avec des CRC valides ; le scénario a ensuite réussi sans désactiver sa vérification.

## Limites explicites

Les photos déjà consultées peuvent être relues hors réseau dans leur périmètre local. Leur envoi/remplacement/retrait demeure une action serveur : ces boutons sont désactivés hors connexion, et aucun envoi de photo différé n’est promis. Le cache est borné et dépend de l’espace accordé par le navigateur ; la recette ne garantit pas une durée universelle de plusieurs jours sur tous les appareils.

La recette réseau des photos utilise une image synthétique et des réponses HTTP simulées. Aucun objet de test n’a été ajouté au stockage réel. Le pilote Manus/Forge peut ne pas supporter la suppression physique : les pointeurs sont retirés et l’accès au relais est bloqué, mais les octets peuvent rester chez le fournisseur. Les snapshots contiennent les pointeurs photo, pas une copie autonome des octets externes ; une restauration d’image exige aussi la conservation de l’objet dans le stockage. Le S3 externe et le SMTP ne sont toujours pas configurés/validés par cette livraison.

**YengaPay reste en pause SANDBOX** : aucun PayIn, checkout, paiement ou abonnement n’a été activé. Le lot I et les prérequis externes du lancement restent ouverts.

## Livraison

Archive source : `/home/ubuntu/stockpilot-pro-latest-2026-11-13.zip`, avec schéma, migrations, lockfile, tests, continuité et cette note. L’archive n’inclut ni `.env`, ni secrets de l’environnement, base de données, fichiers Git, dépendances installées, traces de navigateur ou exports métier. Elle n’est pas une sauvegarde des données MySQL ou des files locales des appareils.

Le checkpoint final représente la version exacte prête à prévisualiser et publier dans WebDev. Une publication du domaine public doit être distinguée de la création du checkpoint et de la mise à jour de l’aperçu.
