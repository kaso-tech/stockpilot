import { ImportExportControls } from "@/components/ImportExportControls";
import { BulkPhotoImport } from "@/components/BulkPhotoImport";
import { compressProductImage } from "@/lib/productImage";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceTiers, parsePriceTiers, type CsvRow } from "@/lib/csv";
import { trpc } from "@/lib/trpc";
import { FileSpreadsheet, Package, Truck, UsersRound } from "lucide-react";

const toCents = (value: string | undefined) =>
  Math.round(Number((value || "0").replace(/\s/g, "").replace(",", ".")) * 100);

export default function DataExchange() {
  const { can } = usePermissions();
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: customers = [] } = trpc.commerce.customers.list.useQuery();
  const createProduct = trpc.products.create.useMutation();
  const fetchRemoteImage = trpc.products.fetchRemoteImage.useMutation();
  const uploadImage = trpc.products.uploadImage.useMutation();
  /** Colonne photo_url : téléchargée par le serveur, compressée ici, puis enregistrée. */
  const attachRemotePhoto = async (productId: number, url: string) => {
    const { dataUrl } = await fetchRemoteImage.mutateAsync({ url });
    const blob = await (await fetch(dataUrl)).blob();
    const compressed = await compressProductImage(
      new File([blob], "photo", { type: blob.type })
    );
    await uploadImage.mutateAsync({ productId, ...compressed });
  };
  const createSupplier = trpc.suppliers.create.useMutation();
  const createCustomer = trpc.commerce.customers.create.useMutation();
  const importProducts = async (rows: CsvRow[]) => {
    let imported = 0;
    const errors: string[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        const reference = row.reference?.trim();
        const name = row.name?.trim();
        const photoUrl = (row.photo_url || row.photourl || "").trim();
        // Référence déjà au catalogue : la ligne sert seulement à ajouter sa photo.
        const existing = reference
          ? products.find(
              product =>
                product.reference.toLowerCase() === reference.toLowerCase()
            )
          : undefined;
        if (existing) {
          if (!photoUrl)
            throw new Error(`la référence ${reference} existe déjà`);
          try {
            await attachRemotePhoto(existing.id, photoUrl);
          } catch (error) {
            throw new Error(
              `photo non ajoutée (${error instanceof Error ? error.message : "échec"})`
            );
          }
          imported += 1;
          continue;
        }
        if (!reference || !name || !row.category || !row.unit)
          throw new Error("référence, nom, catégorie et unité requis");
        const quantity = Number(row.quantity || 0);
        const minimumQuantity = Number(
          row.minimum_quantity || row.minimumquantity || 0
        );
        if (!Number.isInteger(quantity) || !Number.isInteger(minimumQuantity))
          throw new Error("quantités entières requises");
        const created = await createProduct.mutateAsync({
          reference,
          name,
          description: row.description || null,
          category: row.category,
          unit: row.unit,
          purchasePriceCents: toCents(row.purchase_price || row.purchaseprice),
          retailPriceCents: toCents(row.retail_price || row.retailprice),
          wholesalePriceCents: toCents(
            row.wholesale_price || row.wholesaleprice
          ),
          quantity,
          minimumQuantity,
          supplierId: row.supplier_id ? Number(row.supplier_id) : null,
          retailPriceTiers: parsePriceTiers(row.retail_tiers),
          wholesalePriceTiers: parsePriceTiers(row.wholesale_tiers),
        });
        imported += 1;
        if (photoUrl)
          try {
            await attachRemotePhoto(created.id, photoUrl);
          } catch (error) {
            errors.push(
              `ligne ${index + 2} — produit créé, photo non ajoutée (${error instanceof Error ? error.message : "échec"})`
            );
          }
      } catch (error) {
        errors.push(
          `ligne ${index + 2} — ${error instanceof Error ? error.message : "invalide"}`
        );
      }
    }
    utils.products.list.invalidate();
    return { imported, errors };
  };
  const importSuppliers = async (rows: CsvRow[]) => {
    let imported = 0;
    const errors: string[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error("nom requis");
        await createSupplier.mutateAsync({
          name,
          address: row.address || null,
          email: row.email || null,
          phone: row.phone || null,
          taxNumber: row.tax_number || row.taxnumber || null,
          otherReference: row.other_reference || row.otherreference || null,
          notes: row.notes || null,
        });
        imported += 1;
      } catch (error) {
        errors.push(
          `ligne ${index + 2} — ${error instanceof Error ? error.message : "invalide"}`
        );
      }
    }
    utils.suppliers.list.invalidate();
    return { imported, errors };
  };
  const importCustomers = async (rows: CsvRow[]) => {
    let imported = 0;
    const errors: string[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error("nom requis");
        await createCustomer.mutateAsync({
          name,
          type: ["wholesale", "grossiste"].includes(row.type?.toLowerCase())
            ? "wholesale"
            : "ordinary",
          address: row.address || null,
          email: row.email || null,
          phone: row.phone || null,
          taxNumber: row.tax_number || row.taxnumber || null,
          otherReference: row.other_reference || row.otherreference || null,
          notes: row.notes || null,
        });
        imported += 1;
      } catch (error) {
        errors.push(
          `ligne ${index + 2} — ${error instanceof Error ? error.message : "invalide"}`
        );
      }
    }
    utils.commerce.customers.list.invalidate();
    return { imported, errors };
  };
  if (!can("catalog.manage"))
    return (
      <div className="max-w-3xl py-20 text-center text-muted-foreground">
        Cette fonctionnalité est réservée aux administrateurs.
      </div>
    );
  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          Import & export
        </h1>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <ExchangeCard
          icon={<Package className="h-5 w-5" />}
          title="Produits"
          count={products.length}
          controls={
            <ImportExportControls
              filename="produits.csv"
              headers={[
                "reference",
                "name",
                "description",
                "category",
                "unit",
                "purchase_price",
                "retail_price",
                "wholesale_price",
                "quantity",
                "minimum_quantity",
                "supplier_id",
                "retail_tiers",
                "wholesale_tiers",
                "photo_url",
              ]}
              rows={products.map(product => [
                product.reference,
                product.name,
                product.description,
                product.category,
                product.unit,
                product.purchasePriceCents / 100,
                product.retailPriceCents / 100,
                product.wholesalePriceCents / 100,
                product.quantity,
                product.minimumQuantity,
                product.supplierId,
                formatPriceTiers(
                  product.retailPriceTiers || product.priceTiers
                ),
                formatPriceTiers(product.wholesalePriceTiers),
                // Les photos enregistrées sont privées à l'entreprise : pas d'adresse exportable.
                "",
              ])}
              onImport={importProducts}
            />
          }
        />
        <ExchangeCard
          icon={<Truck className="h-5 w-5" />}
          title="Fournisseurs"
          count={suppliers.length}
          controls={
            <ImportExportControls
              filename="fournisseurs.csv"
              headers={[
                "name",
                "address",
                "email",
                "phone",
                "tax_number",
                "other_reference",
                "notes",
              ]}
              rows={suppliers.map(supplier => [
                supplier.name,
                supplier.address,
                supplier.email,
                supplier.phone,
                supplier.taxNumber,
                supplier.otherReference,
                supplier.notes,
              ])}
              onImport={importSuppliers}
            />
          }
        />
        <ExchangeCard
          icon={<UsersRound className="h-5 w-5" />}
          title="Clients"
          count={customers.length}
          controls={
            <ImportExportControls
              filename="clients.csv"
              headers={[
                "name",
                "type",
                "address",
                "email",
                "phone",
                "tax_number",
                "other_reference",
                "notes",
              ]}
              rows={customers.map(customer => [
                customer.name,
                customer.type,
                customer.address,
                customer.email,
                customer.phone,
                customer.taxNumber,
                customer.otherReference,
                customer.notes,
              ])}
              onImport={importCustomers}
            />
          }
        />
      </div>
      <BulkPhotoImport products={products} />
      <Card className="border-primary/20 bg-primary/[0.04] gap-0 py-0">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            Pour les produits, utilisez le format de palier{" "}
            <strong>seuil:prix|seuil:prix</strong>, par exemple{" "}
            <strong>5:115000|10:110000</strong>. La colonne{" "}
            <strong>photo_url</strong> accepte l’adresse https d’une photo
            (JPEG, PNG ou WEBP, 8 Mo maximum) ; pour une référence déjà au
            catalogue, la ligne ajoute seulement sa photo. Exportez d’abord un
            modèle vide ou une liste pour vérifier les colonnes attendues.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ExchangeCard({
  icon,
  title,
  count,
  controls,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  controls: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="pb-3">
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        <p className="text-xs text-faint">
          {count} entrée{count > 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent>{controls}</CardContent>
    </Card>
  );
}
