import { describe, expect, it } from "vitest";
import { normalizeSellerDiscountPermissions } from "./sellerDiscountPermissions";

describe("normalizeSellerDiscountPermissions", () => {
  it("conserve les plafonds des remises explicitement autorisées", () => {
    expect(normalizeSellerDiscountPermissions({ sellerCanLineDiscount: true, sellerMaxLineDiscountPercent: 8, sellerCanInvoiceDiscount: true, sellerMaxInvoiceDiscountPercent: 12, sellerCanCartDiscount: true, sellerMaxCartDiscountPercent: 15 })).toEqual({ sellerCanLineDiscount: true, sellerMaxLineDiscountPercent: 8, sellerCanInvoiceDiscount: true, sellerMaxInvoiceDiscountPercent: 12, sellerCanCartDiscount: true, sellerMaxCartDiscountPercent: 15 });
  });

  it("réinitialise le plafond lorsqu’une autorisation est désactivée", () => {
    expect(normalizeSellerDiscountPermissions({ sellerCanLineDiscount: false, sellerMaxLineDiscountPercent: 8, sellerCanInvoiceDiscount: false, sellerMaxInvoiceDiscountPercent: 12, sellerCanCartDiscount: false, sellerMaxCartDiscountPercent: 15 })).toEqual({ sellerCanLineDiscount: false, sellerMaxLineDiscountPercent: 0, sellerCanInvoiceDiscount: false, sellerMaxInvoiceDiscountPercent: 0, sellerCanCartDiscount: false, sellerMaxCartDiscountPercent: 0 });
  });
});
