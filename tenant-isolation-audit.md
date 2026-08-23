# Audit initial d’isolation multi-entreprise

## Protections renforcées dans ce lot

- Les listes et détails de factures sont désormais filtrés par l’entreprise de la session.
- Les contextes client, suggestions de produits, consultations et suppressions de clients sont filtrés par entreprise.
- Les fiches agents et vendeurs contrôlent désormais l’appartenance de la personne consultée avant de retourner ses informations.
- Les logos, signatures et cachets sont maintenant stockés sous un préfixe d’entreprise plutôt que sous l’identifiant de l’utilisateur qui les téléverse.
- La génération des commissions de facture ne sélectionne plus que les profils de rémunération actifs de l’entreprise courante.

## Tables déjà directement rattachées à une entreprise

`users`, `suppliers`, `purchaseOrders`, `products`, `productCategories`, `productUnits`, `customers`, `agents`, `remunerationProfiles`, `saleSettings`, `sales`, `expenses`, `expenseBudgets`, `inventorySessions`, `stockMovements`, `stockAlerts`, `auditLogs`, `backupSettings` et `backupArchives` portent déjà un identifiant d’entreprise.

## Priorités restantes

1. Ajouter ou déduire de manière contrôlée le périmètre entreprise pour les tables enfants : lignes de commande, paliers, lignes et paiements de vente, commissions, paiements agents et lignes d’inventaire.
2. Remplacer les contraintes globales de référence, nom ou numéro de document par des contraintes composées avec l’entreprise lorsque nécessaire.
3. Parcourir les routeurs achats, inventaire, transactions, dépenses, sauvegardes et export pour vérifier chaque lecture, écriture et téléchargement.
4. Ajouter des tests qui tentent explicitement d’accéder à l’identifiant d’une seconde entreprise et attendent un refus ou une absence de résultat.

## Sauvegardes : chantier d’isolation restant

Les archives existantes doivent être rattachées au fichier, à la rétention, au téléchargement et à la restauration d’une seule entreprise. Une restauration ne devra jamais supprimer ni remplacer les données d’une autre entreprise.
