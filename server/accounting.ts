/**
 * Exports comptables (9.5) : journal des ventes et des encaissements en CSV et
 * écritures au format FEC (fichier des écritures comptables, art. A47 A-1 du
 * LPF), avec les comptes du plan comptable général français ou de SYSCOHADA.
 * Fonctions pures : les données sont chargées par le routeur.
 */

export type Referential = "pcg" | "syscohada";

export const ACCOUNTS: Record<
  Referential,
  Record<
    "customers" | "sales" | "delivery" | "vat" | "cash" | "bank",
    { number: string; label: string }
  >
> = {
  pcg: {
    customers: { number: "411000", label: "Clients" },
    sales: { number: "707000", label: "Ventes de marchandises" },
    delivery: {
      number: "708500",
      label: "Ports et frais accessoires facturés",
    },
    vat: { number: "445710", label: "TVA collectée" },
    cash: { number: "531000", label: "Caisse" },
    bank: { number: "512000", label: "Banque" },
  },
  syscohada: {
    customers: { number: "411100", label: "Clients" },
    sales: { number: "701100", label: "Ventes de marchandises" },
    delivery: {
      number: "707100",
      label: "Produits accessoires (frais de livraison)",
    },
    vat: { number: "443100", label: "TVA facturée sur ventes" },
    cash: { number: "571100", label: "Caisse" },
    bank: { number: "521100", label: "Banques" },
  },
};

export type SaleRecord = {
  id: number;
  invoiceNumber: string;
  channel: "pos" | "invoice" | "quote";
  status: "draft" | "partial" | "paid" | "void";
  customerId: number | null;
  customerName: string | null;
  totalCents: number;
  vatCents: number;
  deliveryFeeCents: number;
  amountPaidCents: number;
  returnedCents: number;
  createdAt: Date;
  voidedAt: Date | null;
  refundedAt: Date | null;
  creditNoteNumber: string | null;
};
export type ReturnRecord = {
  saleId: number;
  creditNoteNumber: string;
  refundCents: number;
  createdAt: Date;
};
export type PaymentRecord = {
  saleId: number;
  invoiceNumber: string;
  method: string;
  amountCents: number;
  createdAt: Date;
  customerId: number | null;
  customerName: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  mobile_money: "Mobile money",
  bank_transfer: "Virement",
  credit: "Crédit client",
};

export function amount(cents: number, separator = ",") {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}${separator}${String(absolute % 100).padStart(2, "0")}`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV « Excel français » : séparateur point-virgule, BOM UTF-8. */
export function toCsv(header: string[], rows: Array<Array<string | number>>) {
  return (
    "﻿" +
    [header, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n") +
    "\r\n"
  );
}

/** Un document de vente est comptabilisé dès qu'il est émis ; un ticket de caisse dès son encaissement. */
export function isPostedSale(sale: SaleRecord) {
  if (sale.channel === "quote") return false;
  if (sale.channel === "pos" && sale.status === "draft") return false;
  return true;
}

const STATUS_LABELS: Record<SaleRecord["status"], string> = {
  draft: "Non encaissée",
  partial: "Partiellement encaissée",
  paid: "Encaissée",
  void: "Annulée",
};

export function salesJournalCsv(
  sales: SaleRecord[],
  dayOf: (date: Date) => string
) {
  const rows = sales.filter(isPostedSale).map(sale => {
    const taxable = sale.totalCents - sale.vatCents - sale.deliveryFeeCents;
    return [
      dayOf(sale.createdAt),
      sale.invoiceNumber,
      sale.channel === "pos" ? "Ticket" : "Facture",
      sale.customerName ?? "Vente comptoir",
      amount(taxable),
      amount(sale.vatCents),
      amount(sale.deliveryFeeCents),
      amount(sale.totalCents),
      amount(sale.amountPaidCents),
      amount(sale.returnedCents),
      STATUS_LABELS[sale.status],
      sale.creditNoteNumber ?? "",
    ];
  });
  return toCsv(
    [
      "Date",
      "Numéro",
      "Type",
      "Client",
      "Base HT",
      "TVA",
      "Frais de livraison",
      "Total TTC",
      "Encaissé",
      "Retours",
      "Statut",
      "Avoir",
    ],
    rows
  );
}

export function paymentsJournalCsv(
  payments: PaymentRecord[],
  dayOf: (date: Date) => string
) {
  const rows = payments.map(payment => [
    dayOf(payment.createdAt),
    payment.invoiceNumber,
    payment.customerName ?? "Vente comptoir",
    METHOD_LABELS[payment.method] ?? payment.method,
    payment.amountCents < 0 ? "Remboursement" : "Encaissement",
    amount(payment.amountCents),
  ]);
  return toCsv(
    ["Date", "Document", "Client", "Moyen", "Nature", "Montant"],
    rows
  );
}

type Line = {
  account: { number: string; label: string };
  aux?: { number: string; label: string };
  debit: number;
  credit: number;
};
type Entry = {
  journal: "VE" | "CA" | "BQ";
  date: string;
  pieceRef: string;
  label: string;
  lines: Line[];
};

const JOURNALS: Record<Entry["journal"], string> = {
  VE: "Ventes",
  CA: "Caisse",
  BQ: "Banque",
};

function customerAux(record: {
  customerId: number | null;
  customerName: string | null;
}) {
  return record.customerId
    ? {
        number: `C${record.customerId}`,
        label: record.customerName ?? `Client ${record.customerId}`,
      }
    : { number: "COMPTOIR", label: "Ventes comptoir" };
}

/** Écritures équilibrées : ventes, annulations, avoirs et encaissements de la période. */
export function accountingEntries(input: {
  sales: SaleRecord[];
  returns: ReturnRecord[];
  payments: PaymentRecord[];
  referential: Referential;
  dayOf: (date: Date) => string;
  inPeriod: (date: Date) => boolean;
}) {
  const accounts = ACCOUNTS[input.referential];
  const entries: Entry[] = [];
  const saleLines = (
    sale: SaleRecord,
    sign: 1 | -1,
    cents?: number
  ): Line[] => {
    const base = sale.totalCents - sale.deliveryFeeCents;
    const total = cents ?? sale.totalCents;
    const delivery = cents === undefined ? sale.deliveryFeeCents : 0;
    const vat =
      cents === undefined
        ? sale.vatCents
        : base > 0
          ? Math.round((sale.vatCents * cents) / base)
          : 0;
    const taxable = total - vat - delivery;
    const customer: Line = {
      account: accounts.customers,
      aux: customerAux(sale),
      debit: sign > 0 ? total : 0,
      credit: sign > 0 ? 0 : total,
    };
    const revenue = (
      account: { number: string; label: string },
      value: number
    ): Line => ({
      account,
      debit: sign > 0 ? 0 : value,
      credit: sign > 0 ? value : 0,
    });
    return [
      customer,
      revenue(accounts.sales, taxable),
      ...(delivery ? [revenue(accounts.delivery, delivery)] : []),
      ...(vat ? [revenue(accounts.vat, vat)] : []),
    ];
  };
  const salesById = new Map(input.sales.map(sale => [sale.id, sale]));
  for (const sale of input.sales.filter(isPostedSale)) {
    if (input.inPeriod(sale.createdAt))
      entries.push({
        journal: "VE",
        date: input.dayOf(sale.createdAt),
        pieceRef: sale.invoiceNumber,
        label: `${sale.channel === "pos" ? "Ticket" : "Facture"} ${sale.invoiceNumber}`,
        lines: saleLines(sale, 1),
      });
    // Facture annulée sans encaissement, ou remboursée en totalité par avoir.
    const reversalDate =
      sale.refundedAt ??
      (sale.status === "void" && !sale.returnedCents ? sale.voidedAt : null);
    if (
      sale.status === "void" &&
      reversalDate &&
      input.inPeriod(reversalDate)
    ) {
      const reversed = sale.totalCents - sale.returnedCents;
      if (reversed > 0)
        entries.push({
          journal: "VE",
          date: input.dayOf(reversalDate),
          pieceRef: sale.creditNoteNumber ?? sale.invoiceNumber,
          label: sale.creditNoteNumber
            ? `Avoir ${sale.creditNoteNumber} sur ${sale.invoiceNumber}`
            : `Annulation ${sale.invoiceNumber}`,
          lines:
            reversed === sale.totalCents
              ? saleLines(sale, -1)
              : saleLines(sale, -1, reversed),
        });
    }
  }
  for (const item of input.returns.filter(item =>
    input.inPeriod(item.createdAt)
  )) {
    const sale = salesById.get(item.saleId);
    if (sale && item.refundCents > 0)
      entries.push({
        journal: "VE",
        date: input.dayOf(item.createdAt),
        pieceRef: item.creditNoteNumber,
        label: `Avoir ${item.creditNoteNumber} sur ${sale.invoiceNumber}`,
        lines: saleLines(sale, -1, item.refundCents),
      });
  }
  for (const payment of input.payments.filter(
    item => input.inPeriod(item.createdAt) && item.amountCents !== 0
  )) {
    const cash = payment.method === "cash";
    const treasury = cash ? accounts.cash : accounts.bank;
    const value = Math.abs(payment.amountCents);
    const incoming = payment.amountCents > 0;
    entries.push({
      journal: cash ? "CA" : "BQ",
      date: input.dayOf(payment.createdAt),
      pieceRef: payment.invoiceNumber,
      label: `${incoming ? "Encaissement" : "Remboursement"} ${payment.invoiceNumber} (${METHOD_LABELS[payment.method] ?? payment.method})`,
      lines: [
        {
          account: treasury,
          debit: incoming ? value : 0,
          credit: incoming ? 0 : value,
        },
        {
          account: accounts.customers,
          aux: customerAux(payment),
          debit: incoming ? 0 : value,
          credit: incoming ? value : 0,
        },
      ],
    });
  }
  return entries.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.journal.localeCompare(right.journal)
  );
}

/** Fichier FEC (18 colonnes, séparateur tabulation, montants à virgule). */
export function fecFile(entries: Entry[], validationDay: string) {
  const header = [
    "JournalCode",
    "JournalLib",
    "EcritureNum",
    "EcritureDate",
    "CompteNum",
    "CompteLib",
    "CompAuxNum",
    "CompAuxLib",
    "PieceRef",
    "PieceDate",
    "EcritureLib",
    "Debit",
    "Credit",
    "EcritureLet",
    "DateLet",
    "ValidDate",
    "Montantdevise",
    "Idevise",
  ];
  const counters = new Map<string, number>();
  const compact = (day: string) => day.replaceAll("-", "");
  const clean = (text: string) => text.replace(/[\t\r\n|]/g, " ");
  const rows = entries.flatMap(entry => {
    const number = (counters.get(entry.journal) ?? 0) + 1;
    counters.set(entry.journal, number);
    return entry.lines.map(line =>
      [
        entry.journal,
        JOURNALS[entry.journal],
        `${entry.journal}${String(number).padStart(6, "0")}`,
        compact(entry.date),
        line.account.number,
        clean(line.account.label),
        line.aux?.number ?? "",
        clean(line.aux?.label ?? ""),
        clean(entry.pieceRef),
        compact(entry.date),
        clean(entry.label),
        amount(line.debit),
        amount(line.credit),
        "",
        "",
        compact(validationDay),
        "",
        "",
      ].join("\t")
    );
  });
  return [header.join("\t"), ...rows].join("\r\n") + "\r\n";
}

export function entriesAreBalanced(entries: Entry[]) {
  return entries.every(
    entry =>
      entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0) === 0
  );
}
