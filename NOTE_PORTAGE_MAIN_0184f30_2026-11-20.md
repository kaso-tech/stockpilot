# StockPilot Pro — Portage sélectif de GitHub main `0184f30`

**Livraison :** 20 novembre 2026. **Socle préservé :** checkpoint `651bd0f9` sur `integrate/github-latest-2026-11-13`.

## 1. Décision et source

L’utilisateur a corrigé son choix initial de remplacement intégral et demandé de reprendre l’intégration sélective recommandée. Le code StockPilot livré précédemment est donc conservé. La tête `refs/heads/main` du dépôt GitHub `kaso-tech/stockpilot` a été revérifiée le 20 novembre à 20:20 UTC : `0184f30428349de4629a04948142f1548c7fdbd2`.

Le remote interne `origin` n’a pas été modifié et reste inaccessible depuis ce terminal. La source GitHub est disponible séparément sous `github`. Aucun succès de `git pull origin main`, fusion globale, push GitHub ou publication du domaine n’est revendiqué. Le checkpoint WebDev de cette livraison est communiqué séparément dans le message final.

Sauvegardes locales conservées : `backup/pre-replace-github-main-2026-11-20` et `backup/local-main-pre-0184f30-2026-11-20`, en plus des sauvegardes antérieures. La bascule exploratoire vers l’arbre GitHub a été annulée avant le portage applicatif ; aucune donnée métier n’a été remplacée.

## 2. Contenu intégré

Les apports visuels compatibles de `5f32871` et `0184f30` ont été adaptés au socle local :

- Transitions courtes des couleurs, fonds et bordures des contrôles, dans la couche CSS de base pour ne pas neutraliser les variantes de composants existantes.
- Relief et ombre discrets sur sept boutons-cartes déjà cliquables : historique agent, liste agents, historique client, sélection de produit de facture, liste des bons de commande, liste des devis et commandes de la fiche fournisseur.
- Survol de 2 px uniquement quand le périphérique sait survoler et que l’utilisateur n’a pas demandé de réduire les mouvements. Le déplacement Tailwind antérieur a été retiré sur trois cartes pour éviter son cumul.
- Mode mouvement réduit : aucune transformation ni transition de ces cartes. Le CSS compilé est testé dans le navigateur, pas seulement son source.
- Fonds de survol des cartes Agents et Devis remplacés par `bg-accent` : l’ancien fond sombre fixe était illisible en thème clair. Le titre de la carte Devis au survol est vérifié à un contraste d’au moins 4,5:1 dans les deux thèmes et les deux formats.

Le bleu par défaut `#2563EB`, les fonds locaux des thèmes, les dimensions et les préférences existantes sont préservés. Aucun nouveau bouton, champ, flux de données ou traitement serveur n’est ajouté. Les états de chargement existants ne sont pas remplacés.

Le shell, les grilles globales, `PointOfSale` et `CheckoutSheet` ne reçoivent aucune classe de transformation. Les animations d’entrée avec transform persistant, le stagger global, le shimmer permanent et les nouveaux effets de caisse ne sont pas importés.

## 3. Apports non intégrés en bloc

| Source | Décision |
|---|---|
| `a460482` — refonte de nombreuses pages | Exclue du portage global : elle remplacerait des vues et fonctionnalités locales plus récentes. |
| `347726f` — annulation des ventes POS en attente et refonte du panier | Non copié : contrôles d’affectation entrepôt vendeur à adapter avant intégration ; caisse locale conservée. |
| `574df54` — association de photos par import | Non copié : import distant par URL présentant notamment des risques SSRF et de correspondance des produits. |
| `840e767` — réinitialisation complète et suppression définitive d’entrepôt | Exclu : opérations destructives incompatibles avec l’intégrité et les relations du socle local. |
| `5f32871`, `0184f30` — relief/animations | Portage partiel sûr décrit ci-dessus ; palette distante et effets globaux non importés. |

La livraison n’est pas équivalente à l’arbre exact de `0184f30`, volontairement. Ces exclusions ne sont pas des fonctionnalités déclarées terminées.

## 4. Données et sécurité

**Aucune migration, suppression ni écriture de données métier n’a été effectuée pour cette livraison.** Le schéma reste à `0079_product_images.sql`, avec 80 artefacts SQL historiques contrôlés. Ne pas rejouer ces migrations sur une base déjà migrée.

Les permissions, contrôles serveur, protections d’entrées, requêtes paramétrées, périmètres entreprise/entrepôt et caches hors ligne ne sont pas modifiés par ce portage de classes CSS. La PWA continue d’exiger une confirmation explicite avant activation de mise à jour. Aucun paiement, checkout ou abonnement n’a été activé ; YengaPay reste en pause SANDBOX.

## 5. Validation réellement exécutée

| Contrôle | Résultat final |
|---|---|
| Installation | `pnpm install --frozen-lockfile` réussi ; `package.json`, `pnpm-lock.yaml` et le schéma inchangés. |
| TypeScript frais | `pnpm exec tsc --noEmit --incremental false` réussi ; contrôle standard également réussi après suppression du cache incrémental périmé. |
| Vitest | **136 fichiers / 359 tests réussis**, dont trois nouveaux tests de garde du portage visuel. |
| Build production et PWA | Réussi ; **124 ressources précachées**. L’avertissement de chunks > 500 kB reste non bloquant et ne constitue pas une garantie de performance. |
| Playwright | **12 scénarios réussis** avec API simulée et `DATABASE_URL` vide, dont trois nouveaux scénarios de relief, contraste/motion réduite et panier POS fixe desktop/mobile. |
| Release | `pnpm verify:release` réussi : audit production sans vulnérabilité connue, cohérence migrations, Selects contrôlés stables et protections HTTP vérifiées. |
| HTTP | Racine publique en 200 ; routes métier/plateforme et stockage tenant non authentifiés en 401 ; webhook YengaPay non signé en 401. Serveur temporaire de test sans base métier arrêté après recette. |
| Visuel | Captures Devis clair/sombre desktop/mobile et panier POS desktop/mobile inspectées sur données synthétiques. |
| Diff | `git diff --check` réussi. Relecture indépendante du périmètre purement visuel effectuée ; cumul de déplacement signalé puis corrigé. |

Deux corrections ont résulté de la recette : la combinaison CSS `transform: none` + `translate: none` était transformée par le compilateur en matrice d’identité ; le reset `translate` inutile a été retiré, et l’assertion navigateur stricte a été conservée. Le scénario Dépenses offline attend désormais le contrôle effectif de la page par le service worker et charge les deux pages avant coupure : son ancienne course pouvait tenter de charger un module jamais contrôlé par la PWA. Aucune erreur n’est masquée et les assertions offline sont conservées et renforcées.

Les anciens diagnostics du watcher ou journaux de serveur ne sont pas les résultats du typage frais. La validation ne revendique aucun succès de CI distante, envoi SMTP/S3 réel, ni essai offline de plusieurs jours sur tous les appareils.

## 6. Livraison et reprise

Archive source : `/home/ubuntu/stockpilot-pro-selective-0184f30-2026-11-20.zip`. Elle contient le code actuel préservé, le portage, le lockfile, les tests, l’historique de migrations et la continuité, mais aucun `.env`, secret d’environnement détecté, fichier de base métier, dépendance installée, `.git`, build ou trace de recette. Le CRC ZIP et le SHA-256 sont vérifiés avant remise. Ce ZIP n’est pas une sauvegarde de base, d’objets externes ou des files IndexedDB des appareils.

Pour reprendre : lire cette note puis `RESUME_CONTINUITE_PROJET.md`, vérifier le dernier commit et la branche de travail avant modification collaborative. Ne pas faire un remplacement ou un merge brut de `main` sous prétexte qu’il pointe sur `0184f30`. La publication éventuelle est une étape séparée du checkpoint ; SMTP, S3 externes, prérequis commerciaux et tâches YengaPay ouvertes restent à traiter selon les décisions antérieures.
