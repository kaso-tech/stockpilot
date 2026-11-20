export function inventoryDifference(expectedQuantity: number, countedQuantity: number) {
  if (!Number.isInteger(expectedQuantity) || !Number.isInteger(countedQuantity) || expectedQuantity < 0 || countedQuantity < 0) {
    throw new Error("Les quantités d’inventaire doivent être des entiers positifs ou nuls.");
  }
  return countedQuantity - expectedQuantity;
}

export function shouldCreateAdjustment(expectedQuantity: number, countedQuantity: number) {
  return inventoryDifference(expectedQuantity, countedQuantity) !== 0;
}
