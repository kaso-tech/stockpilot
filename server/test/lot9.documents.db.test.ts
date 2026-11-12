import { beforeEach, describe, expect, it } from "vitest";
import {
  ctx,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";
import { memoryOutbox } from "../mailer";
import { clearRateLimitsForTests } from "../rateLimit";

process.env.MAIL_TRANSPORT = "memory";
const pdf = Buffer.from("%PDF-1.4\n" + "x".repeat(200)).toString("base64");
const send = (id: number) => ({
  id,
  pdfBase64: pdf,
  filename: "FAC-2026-000001.pdf",
  subject: "Votre facture",
  message: "Bonjour, voici votre facture.",
});

describe.skipIf(!realDbUrl)(
  "Lot 9.9 — envoi des documents par e-mail (MySQL réel)",
  () => {
    let a: SeededTenant;
    beforeEach(async () => {
      clearRateLimitsForTests();
      memoryOutbox.length = 0;
      await resetDatabase();
      a = await seedTenant("a");
    });

    async function invoiceFor(email: string | null) {
      const admin = appRouter.createCaller(ctx(a.admin));
      const { id: productId } = await admin.products.create({
        reference: `P-${Math.random().toString(36).slice(2, 8)}`,
        name: "Produit",
        description: null,
        category: "Divers",
        unit: "pièce",
        purchasePriceCents: 100,
        retailPriceCents: 200,
        wholesalePriceCents: 150,
        quantity: 5,
        minimumQuantity: 0,
        supplierId: null,
      });
      const customer = await admin.commerce.customers.create({
        name: "Client",
        otherReference: null,
        type: "ordinary",
        email,
        phone: null,
        address: null,
        taxNumber: null,
        notes: null,
      });
      return admin.transactions.createDraft({
        channel: "invoice",
        customerId: customer.id,
        note: null,
        items: [{ productId, quantity: 1 }],
        salesAgentId: null,
        cashierId: null,
        salesAgentSelectionMade: true,
        cashierSelectionMade: true,
      });
    }

    it("envoie la facture au client avec le PDF en pièce jointe et trace l'envoi", async () => {
      const invoice = await invoiceFor("client@exemple.test");
      await expect(
        appRouter
          .createCaller(ctx(a.seller))
          .documents.sendSale(send(invoice.id))
      ).resolves.toEqual({ delivered: true });
      expect(memoryOutbox[0]).toMatchObject({
        to: "client@exemple.test",
        subject: "Votre facture",
      });
      expect(
        memoryOutbox[0]!.attachments?.[0]?.content.subarray(0, 5).toString()
      ).toBe("%PDF-");
      expect(
        (await appRouter.createCaller(ctx(a.admin)).audit.list()).some(
          entry => entry.action === "Envoi par e-mail"
        )
      ).toBe(true);
    });

    it("refuse un client sans e-mail, un fichier qui n'est pas un PDF et une facture d'une autre entreprise", async () => {
      const noEmail = await invoiceFor(null);
      await expect(
        appRouter
          .createCaller(ctx(a.admin))
          .documents.sendSale(send(noEmail.id))
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const invoice = await invoiceFor("client@exemple.test");
      await expect(
        appRouter
          .createCaller(ctx(a.admin))
          .documents.sendSale({
            ...send(invoice.id),
            pdfBase64: Buffer.from("<html>" + "x".repeat(200)).toString(
              "base64"
            ),
          })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const b = await seedTenant("b");
      await expect(
        appRouter
          .createCaller(ctx(b.admin))
          .documents.sendSale(send(invoice.id))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(memoryOutbox).toHaveLength(0);
    });
  }
);
