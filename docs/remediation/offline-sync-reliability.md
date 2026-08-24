# Fiabilité de la synchronisation offline

## Corrections

`OfflineContext` utilise désormais un mécanisme single-flight. Les appels déclenchés par l’hydratation, l’événement réseau `online`, le bouton manuel et la reprise d’une opération partagent la même promesse active. Une seule passe de synchronisation peut donc s’exécuter à la fois; les appels concurrents attendent le même résultat.

La persistance IndexedDB n’est plus silencieuse. Chaque écriture expose un état `saving`, `saved` ou `error`. En cas d’échec, le contexte conserve un message générique, journalise uniquement un diagnostic non sensible et le journal de synchronisation affiche une action « Réessayer ». Les erreurs d’hydratation sont également exposées au lieu d’être ignorées.

La chaîne d’écriture reste récupérable après un échec : une écriture suivante n’est pas bloquée par une promesse rejetée, car la chaîne est réinitialisée avant de poursuivre. Le dernier état demandé reste disponible pour une nouvelle tentative.

## Tests

Les tests couvrent le partage de promesse lors de deux appels concurrents, l’autorisation d’une nouvelle passe après la fin de la précédente et le rejet d’une transaction IndexedDB contenant une donnée non sérialisable.

Le cycle complet est validé : `pnpm check`, `pnpm test` et `pnpm build`. Résultat : 73 fichiers de test passés, 2 ignorés; 177 tests passés, 4 ignorés; build PWA réussi.

## Limite

Cette correction sérialise les synchronisations dans une même instance de page. Elle ne fournit pas encore un mécanisme Background Sync lorsque l’application est complètement fermée; ce sujet reste distinct et documenté dans l’audit de synchronisation.
