import { describe, expect, it } from "vitest";
import { assertSellerDiscount, assertSellerUnitPrice } from "./sellerPriceRules";

const locked = { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 5 };
describe("règles de prix vendeur", () => {
  it("refuse un tarif différent sans autorisation", () => expect(() => assertSellerUnitPrice(locked, 10000, 11000)).toThrow("modification du prix"));
  it("accepte un prix autorisé et bloque un prix inférieur non autorisé", () => { expect(() => assertSellerUnitPrice({ ...locked, sellerCanOverridePrice: true }, 10000, 11000)).not.toThrow(); expect(() => assertSellerUnitPrice({ ...locked, sellerCanOverridePrice: true }, 10000, 9000)).toThrow("prix inférieur"); });
  it("accepte un prix inférieur lorsque l’autorisation dédiée est active", () => expect(() => assertSellerUnitPrice({ ...locked, sellerCanSellBelowPrice: true }, 10000, 9000)).not.toThrow());
  it("applique le plafond de remise vendeur", () => { expect(() => assertSellerDiscount(locked, 10000, 500)).not.toThrow(); expect(() => assertSellerDiscount(locked, 10000, 501)).toThrow("dépasse"); });
});
