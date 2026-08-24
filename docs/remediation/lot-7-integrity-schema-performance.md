# Lot 7 — Intégrité métier, schéma et performance

**Statut :** Validé localement  
**Objectif :** borner les entrées numériques, préserver l’idempotence des mutations financières et préparer les index de lecture sans migration destructive.

## Corrections réalisées

Les quantités de stock sont désormais bornées à une capacité compatible avec les colonnes `INT` et les mouvements refusent les stocks négatifs ou les dépassements. Les montants de règlement sont validés comme entiers sûrs, positifs et compatibles avec la capacité de la base. Les paniers, quantités unitaires, prix manuels et remises sont bornés par les schémas Zod; les remises en pourcentage ne peuvent pas dépasser 100 %.

Les calculs de sous-total, total de ligne, coût, total de facture et bénéfice net passent par une assertion d’entier base de données. Les contrôles d’idempotence offline des créations et encaissements conservent leur périmètre entreprise/utilisateur. Les mises à jour et journaux des ventes incluent le périmètre entreprise explicite.

Les index de consultation ont été ajoutés au schéma pour les utilisateurs, ventes, paiements, lignes de vente, mouvements de stock et journaux d’audit. La migration non destructive générée est `drizzle/0041_nosy_goblin_queen.sql`. Elle doit être appliquée par le pipeline base de données configuré; aucune base distante n’a été contactée pendant ce lot.

## Contrôles

```text
pnpm check  : réussi
pnpm test   : réussi — 71 fichiers passés, 2 ignorés; 170 tests passés, 4 ignorés
pnpm build  : réussi
```

Les tests ciblés des règles numériques, encaissements et ventes passent également. Le message fonctionnel historique sur le refus d’un stock négatif a été conservé pour éviter une régression de contrat.

## Limites transférées

Les contraintes `NOT NULL` et les unicités composites tenant-aware des anciennes colonnes restent à traiter dans un lot de migration de données dédié, car leur application exige un inventaire et une conversion des lignes legacy. La migration 0041 ajoute seulement des index et n’est pas appliquée automatiquement à une base distante.
