export function isCheckoutShortcut(input: { key: string; targetTag?: string; isContentEditable?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
  const isEditing = input.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(input.targetTag ?? "");
  return input.key === "F9" && !isEditing && !input.altKey && !input.ctrlKey && !input.metaKey && !input.shiftKey;
}

export function stockAfterCartSelection(quantity: number, selectedQuantity: number, minimumQuantity: number) {
  const remainingAfterSale = Math.max(0, quantity - selectedQuantity);
  return { remainingAfterSale, isLowStock: minimumQuantity > 0 && remainingAfterSale <= minimumQuantity };
}
