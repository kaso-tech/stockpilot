# StockPilot Pro — Synchronisation et livraison du 20 novembre 2026

## Source et méthode

La tête de la branche de collaboration `ccr-1f2b32f0-8cxy1l` du dépôt `kaso-tech/stockpilot` a été récupérée dans `github/november-latest` et revérifiée le 20 novembre 2026 à 14:36 UTC : `52dd44a010c4e8a53cefac40395dc0935523024c`. Le `main` GitHub reste sur l’ancien commit `81833c5db13cfb89e9c015439c94e825c3928466`.

Les nouveautés des commits `3272f92` (menu du compte et proposition de couleur par défaut) et `52dd44a` (vue d’ensemble en cinq blocs et graphique des dépenses) sont portées sélectivement sur le socle validé au checkpoint `b5ccfb22`. Une fusion globale écraserait ou supprimerait de nombreuses fonctions locales : le livrable n’est donc pas une copie brute de la branche distante ni un `pull --rebase` du `main` ancien.

Sauvegarde locale : `backup/pre-pull-2026-11-20`. Branche de travail : `integrate/github-latest-2026-11-13`. Aucun push GitHub, changement de l’historique partagé ou publication du domaine public n’est effectué dans cette livraison.

## Nouveautés intégrées

| Domaine | Contenu et compatibilité conservée |
|---|---|
| Vue d’ensemble | Nouvelle hiérarchie en cinq blocs : accueil/actions rapides, indicateurs, tendance et éléments à traiter, dépenses/budget, ventes récentes/état du stock. |
| Indicateurs | Les calculs locaux de chiffre d’affaires, marge, bénéfice net, créances et valeur du stock sont conservés. Les requêtes gardent la portée entreprise et entrepôt actif. Le total historique des dépenses et sa part de paie restent visibles dans les priorités autorisées, même si les blocs métriques/dépenses sont masqués. |
| Préférences | La nouvelle clé `todo` agrège les anciennes préférences de priorités, factures et stock lorsque le choix explicite n’existe pas. Les clés historiques sont conservées ; les restrictions financières des vendeurs restent appliquées. |
| Compte | Déclencheur du menu cliquable sur toute sa surface, ouverture adaptée à la sidebar desktop et aux petits écrans. Les entrées et permissions locales ne sont pas remplacées. |
| Dépenses | Graphique en anneau et légende colorée dans le rapport mensuel. Montants, catégories, inclusion de la paie agents, registre, justificatifs et échéances locales sont conservés. Le graphique utilise les données de l’API déjà filtrées, pas une nouvelle source non isolée. |
| Apparence | Bleu par défaut `#2563EB` conservé. Légende et infobulle utilisent des couleurs distinctes et les jetons de thème. |
| Hors connexion | Aucun nouveau polling, rechargement de document ou service de synchronisation n’est introduit. Le cache par entreprise/utilisateur/entrepôt et la confirmation explicite des mises à jour PWA sont conservés. |

## Migration exclue et données préservées

La migration distante `0056_default_primary_color.sql` n’est pas importée : elle convertirait la préférence enregistrée `#2563EB` en `#0B6E76`, contrairement à la demande de l’utilisateur. Son numéro `0056` entre également en conflit avec l’historique local.

**Aucune nouvelle migration ni écriture de données métier n’est effectuée pour cette synchronisation.** Le schéma reste à `0079_product_images.sql`. Les 80 artefacts SQL de l’historique local sont présents et passent le contrôle de cohérence. Ne pas rejouer cet historique sur une base déjà migrée. Cette archive source n’est pas une sauvegarde MySQL, du stockage externe ou des files IndexedDB présentes sur les appareils.

## Validation finale

| Contrôle | Résultat |
|---|---|
| TypeScript frais | `pnpm exec tsc --noEmit --incremental false` réussi. |
| TypeScript standard | `pnpm check` réussi après suppression du seul cache incrémental périmé `node_modules/typescript/tsbuildinfo`. Aucun correctif de route SaaS ni désactivation de contrôle de type n’a été nécessaire. Les anciens diagnostics affichés par le watcher ne représentent pas cette compilation fraîche. |
| Vitest | **135 fichiers / 356 tests réussis**. |
| Build production/PWA | Réussi ; **124 entrées précachées**. L’avertissement de chunks supérieurs à 500 kB reste non bloquant et ne constitue pas un résultat de performance garanti. |
| Audit et release | `pnpm verify:release` réussi ; aucune vulnérabilité de production connue signalée par l’audit. Routes protégées, stockage non authentifié et webhook YengaPay non signé refusés. |
| Navigateur | **9 scénarios Playwright réussis** sur build de production et API simulée, sans base métier : authentification, navigation SPA, cache offline, confirmation PWA, lecture seule, photos/purge, recherche/thèmes, rapport des dépenses avec anneau et portée d’entrepôt en mobile/offline, conservation des dépenses dans les priorités sans divulgation au vendeur. |
| Visuel | Vue d’ensemble et Dépenses inspectées dans l’aperçu en desktop et mobile. Le mois courant sans dépenses affiche un état vide ; la recette synthétique vérifie le graphique alimenté. |
| Diff | `git diff --check` réussi. |

Les statuts CI distants des deux derniers commits indiquaient un échec `quality`, sans journal exploitable obtenu. Les validations locales ci-dessus ont été réellement exécutées ; elles ne sont pas présentées comme une correction ou un succès de la CI distante.

## Limites et décisions toujours en vigueur

**YengaPay reste en pause SANDBOX** : aucun PayIn, checkout, paiement ou abonnement activé. Les tâches du lot I restent ouvertes et ne sont pas clôturées artificiellement par cette synchronisation. SMTP et S3 externes restent soumis à configuration et validation. Cette livraison n’est pas une autorisation d’ouverture commerciale large et ne remplace pas les prérequis du registre de lancement.

La recette offline confirme la relecture de données déjà chargées et la stabilité de la navigation dans un environnement de test. Elle ne garantit pas plusieurs jours de fonctionnement universel sur tous les appareils ni l’enregistrement hors ligne de toutes les actions serveur, notamment les pièces jointes.

## Livrables et reprise

Archive source : `/home/ubuntu/stockpilot-pro-latest-2026-11-20.zip`. Elle contient code, schéma, migrations, lockfile, tests, documentation de continuité et cette note, sans `.env`, secrets d’environnement détectés, base métier, objets externes, `.git`, dépendances installées ou traces de recette. L’intégrité ZIP et le SHA-256 sont contrôlés avant remise.

Le checkpoint final est communiqué séparément dans la livraison. Il représente l’état prêt à prévisualiser et à publier depuis WebDev ; sa sauvegarde ne doit pas être confondue avec une publication. Pour reprendre, lire cette note et `RESUME_CONTINUITE_PROJET.md`, vérifier les références Git avant modification et ne pas remplacer le projet par le `main` ancien.
