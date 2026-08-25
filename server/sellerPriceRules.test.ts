import { describe, expect, it } from "vitest";
import { assertSellerDiscount, assertSellerUnitPrice } from "./sellerPriceRules";

const locked = { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 5, sellerCanLineDiscount: false, sellerMaxLineDiscountPercent: 0, sellerCanInvoiceDiscount: false, sellerMaxInvoiceDiscountPercent: 0, sellerCanCartDiscount: false, sellerMaxCartDiscountPercent: 0 };
describe("règles de prix vendeur", () => {
  it("refuse un tarif différent sans autorisation", () => expect(() => assertSellerUnitPrice(locked, 10000, 11000)).toThrow("modification du prix"));
  it("accepte un prix autorisé et bloque un prix inférieur non autorisé", () => { expect(() => assertSellerUnitPrice({ ...locked, sellerCanOverridePrice: true }, 10000, 11000)).not.toThrow(); expect(() => assertSellerUnitPrice({ ...locked, sellerCanOverridePrice: true }, 10000, 9000)).toThrow("prix inférieur"); });
  it("accepte un prix inférieur lorsque l’autorisation dédiée est active", () => expect(() => assertSellerUnitPrice({ ...locked, sellerCanSellBelowPrice: true }, 10000, 9000)).not.toThrow());
  it("refuse une remise lorsque son contexte n’est pas autorisé", () => expect(() => assertSellerDiscount(locked, "line", 10000, 1)).toThrow("n’est pas autorisée"));
  it("applique le plafond propre à chaque contexte de remise", () => { const permissions = { ...locked, sellerCanLineDiscount: true, sellerMaxLineDiscountPercent: 5, sellerCanInvoiceDiscount: true, sellerMaxInvoiceDiscountPercent: 10, sellerCanCartDiscount: true, sellerMaxCartDiscountPercent: 15 }; expect(() => assertSellerDiscount(permissions, "line", 10000, 500)).not.toThrow(); expect(() => assertSellerDiscount(permissions, "line", 10000, 501)).toThrow("dépasse"); expect(() => assertSellerDiscount(permissions, "invoice", 10000, 1000)).not.toThrow(); expect(() => assertSellerDiscount(permissions, "cart", 10000, 1500)).not.toThrow(); });
});
