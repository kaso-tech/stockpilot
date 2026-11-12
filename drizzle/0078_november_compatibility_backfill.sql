-- Reprise tenant-scopée : aucune suppression, quantité ou montant de vente modifié.
UPDATE `warehouseStocks` ws
JOIN `products` p ON p.id = ws.productId AND p.companyId = ws.companyId
SET ws.averageCostCents = p.purchasePriceCents;
--> statement-breakpoint
UPDATE `products` p
JOIN `productCategories` c ON c.companyId = p.companyId AND c.name = p.category
SET p.categoryId = c.id
WHERE p.categoryId IS NULL;
--> statement-breakpoint
UPDATE `products` p
JOIN `productUnits` u ON u.companyId = p.companyId AND u.name = p.unit
SET p.unitId = u.id
WHERE p.unitId IS NULL;
--> statement-breakpoint
UPDATE `saleItems` i
JOIN `sales` s ON s.id = i.saleId
SET i.vatRateBasisPoints = s.vatRateBasisPoints,
    i.vatCents = CASE WHEN s.subtotalCents > 0 THEN ROUND(s.vatCents * i.lineTotalCents / s.subtotalCents) ELSE 0 END
WHERE i.vatRateBasisPoints = 0 AND i.vatCents = 0 AND s.vatCents > 0;
