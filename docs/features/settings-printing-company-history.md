# Paramètres entreprise, impression et historique

Cette évolution sépare l’identité de l’entreprise des réglages de tickets et de périphériques d’impression. L’index Paramètres présente désormais un lien indépendant « Impression et périphériques » avec un formulaire administrateur dédié.

## Périmètre

Le paramètre d’imprimante est enregistré dans `saleSettings`, qui est lu et écrit avec le `companyId` du contexte authentifié. Le nom de l’imprimante est limité à 120 caractères et le type est limité à `browser` ou `thermal`. Aucune adresse réseau, aucun identifiant et aucun secret d’imprimante ne sont stockés.

L’historique des paramètres est servi par la procédure d’audit déjà filtrée par `companyId`. Les écritures du module commerce récupèrent le tenant de l’acteur authentifié avant d’insérer une entrée dans `auditLogs`, afin que les modifications de l’entreprise ne soient pas globales.

## Migration

La migration additive `drizzle/0043_peaceful_thor.sql` ajoute `printerName` et `printerType` avec des valeurs par défaut compatibles avec les réglages existants. Elle ne supprime ni ne réécrit les documents commerciaux historiques.

## Validation attendue

La validation comprend le typage TypeScript, les tests de réglages et de recherche, la suite complète, le build de production, la sonde de release et la vérification du lien public.
