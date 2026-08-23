# Mode hors connexion durable — architecture initiale

Le cache précédent reposait sur `localStorage`, utilisait une clé commune à tout le navigateur et expirait après quatorze jours. Il ne permettait pas d’enregistrer durablement les opérations métier, ni de séparer les données d’entreprises différentes sur un même appareil.

Le socle introduit une base IndexedDB `stockpilot-offline-v2`. Chaque snapshot et opération porte une clé `company:<id>:user:<id>` ; une entreprise ne peut donc pas relire la file ou les données locales d’une autre. Le navigateur est invité à accorder un stockage persistant afin de réduire le risque d’éviction pendant une période prolongée sans réseau.

| Type de donnée | Règle de conflit | Reprise |
|---|---|---|
| Vente POS ou paiement | Événement immuable et idempotent grâce à son identifiant d’opération | Réessai ordonné jusqu’à confirmation serveur |
| Stock | Le serveur reste la référence ; un écart est signalé après synchronisation | Révision manuelle plutôt qu’écrasement silencieux |
| Produit, prix, client ou réglage | Toute modification concurrente est mise en attente | Arbitrage explicite de l’administrateur |
| Données locales d’une autre entreprise | Jamais accessibles via la clé de périmètre | Exclues automatiquement |

La prochaine intégration remplacera progressivement le cache React Query léger par des snapshots métier segmentés, puis reliera la file IndexedDB aux mutations de vente et d’encaissement avec des identifiants idempotents.
