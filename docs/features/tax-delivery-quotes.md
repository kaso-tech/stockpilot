# TVA, frais de livraison et devis

## Fonctionnalités

StockPilot Pro permet désormais de rechercher rapidement un réglage depuis l’index Paramètres. La rubrique Fiscalité permet à l’administrateur de définir l’activation de la TVA et un taux compris entre 0 % et 100 %. Le réglage est scoppé par entreprise.

Les factures, ventes POS, bons de commande et devis utilisent un calcul serveur commun en centimes. Le taux de TVA et le montant calculé sont enregistrés dans le document au moment de sa création afin de préserver les montants historiques même si le paramètre de l’entreprise évolue ensuite. Les frais de livraison sont également enregistrés en centimes et intégrés au total TTC.

Les devis sont un canal commercial distinct (`quote`) : ils sont créés avec le même formulaire que les factures, restent non encaissables, disposent d’une liste dédiée, d’un aperçu et d’un PDF libellé « Devis ». Leur synchronisation offline réutilise le même périmètre IndexedDB entreprise/utilisateur.

## Formule

```text
base taxable = sous-total net - remise facture
TVA          = arrondi(base taxable × taux en points de base / 10 000)
total TTC    = base taxable + TVA + frais de livraison
```

Les champs financiers sont validés côté client pour l’ergonomie et côté serveur pour la sécurité. Le serveur reste la source d’autorité; les totaux affichés dans l’interface ne remplacent pas la validation métier de l’API.

## Migration

La migration `drizzle/0042_commercial_tax_delivery.sql` ajoute les colonnes TVA/livraison aux réglages, ventes et bons de commande, et étend l’énumération de canal des ventes au type `quote`. Elle est additive et doit être appliquée d’abord en préproduction après sauvegarde vérifiée.

## Validation

Les tests ciblés couvrent le calcul TVA, l’arrondi, le taux nul, les frais et le rejet des valeurs invalides. Le cycle complet validé est : `pnpm check`, `pnpm test` et `pnpm build`.
