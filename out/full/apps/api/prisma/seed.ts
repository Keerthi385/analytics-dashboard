/**
 * prisma/seed.ts
 * Run: pnpm --filter api run seed  (or cd apps/api && npm run seed)
 */
import fs from "fs";
import path from "path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type RawRecord = any;

function safe<T>(v: any, def: T): T {
  return v === undefined || v === null ? def : v;
}

function toNumber(v: any) {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const fp = path.join(__dirname, "seed-data", "Analytics_Test_Data.json");
  if (!fs.existsSync(fp)) {
    console.error("Seed file not found:", fp);
    process.exit(1);
  }

  const raw = fs.readFileSync(fp, "utf8");
  const records: RawRecord[] = JSON.parse(raw);

  console.log(`Seeding ${records.length} documents...`);

  for (const r of records) {
    try {
      // Document info
      const sourceId = r._id;
      const fileName = r.name ?? r.metadata?.originalFileName ?? "unknown";
      const filePath = r.filePath ?? "";
      const fileSize = r.fileSize?.$numberLong ? BigInt(r.fileSize.$numberLong) : undefined;
      const fileType = r.fileType ?? "";
      const status = r.status ?? "";
      const createdAt = r.createdAt?.$date ? new Date(r.createdAt.$date) : new Date();
      const updatedAt = r.updatedAt?.$date ? new Date(r.updatedAt.$date) : new Date();

      // extractedData safely
      const extracted = r.extractedData ?? {};
      const llm = extracted.llmData ?? {};

      // invoice fields
      const invoiceBlock = llm.invoice?.value ?? {};
      const invoiceNumber = invoiceBlock.invoiceId?.value ?? null;
      const invoiceDateRaw = invoiceBlock.invoiceDate?.value ?? null;
      const issueDate = invoiceDateRaw ? new Date(invoiceDateRaw) : null;

      // vendor
      const vendorBlock = llm.vendor?.value ?? {};
      const vendorName = vendorBlock.vendorName?.value ?? null;
      const vendorTaxId = vendorBlock.vendorTaxId?.value ?? null;
      const vendorAddress = vendorBlock.vendorAddress?.value ?? null;

      // customer
      const customerBlock = llm.customer?.value ?? {};
      const customerName = customerBlock.customerName?.value ?? null;
      const customerAddress = customerBlock.customerAddress?.value ?? null;

      // summary totals
      const summary = llm.summary?.value ?? {};
      const subTotal = toNumber(summary.subTotal?.value ?? 0);
      const taxTotal = toNumber(summary.totalTax?.value ?? 0);
      const invoiceTotal = toNumber(summary.invoiceTotal?.value ?? 0);

      // line items nested array path:
      // extracted.llmData.lineItems.value.items.value -> array
      const itemsArr =
        llm.lineItems?.value?.items?.value ??
        llm.lineItems?.value?.items ??
        llm.lineItems?.value ??
        [];

      // create / upsert vendor
      // create / upsert vendor (safe duplicate handling)
      let vendorId: string | null = null;

      if (vendorName) {
        try {
          const where = vendorTaxId ? { taxId: vendorTaxId } : { name: vendorName };

          const vendor = await prisma.vendor.upsert({
            where,
            update: { address: vendorAddress, name: vendorName },
            create: { name: vendorName, taxId: vendorTaxId, address: vendorAddress },
          });

          vendorId = vendor.id;
        } catch (err: any) {
          if (err.code === "P2002") {
            console.warn(`⚠️ Duplicate vendor skipped: ${vendorName}`);
            const existing = await prisma.vendor.findFirst({
              where: { name: vendorName },
            });
            vendorId = existing?.id ?? null;
          } else {
            console.error("Unexpected vendor error:", err);
          }
        }
      }


      // create / upsert customer
      // create / upsert customer (safe duplicate handling)
      let customerId: string | null = null;

      if (customerName) {
        try {
          const customer = await prisma.customer.upsert({
            where: { name: customerName },
            update: { address: customerAddress },
            create: { name: customerName, address: customerAddress },
          });

          customerId = customer.id;
        } catch (err: any) {
          if (err.code === "P2002") {
            console.warn(`⚠️ Duplicate customer skipped: ${customerName}`);
            const existing = await prisma.customer.findFirst({
              where: { name: customerName },
            });
            customerId = existing?.id ?? null;
          } else {
            console.error("Unexpected customer error:", err);
          }
        }
      }


      // create invoice (use sourceId as unique reference)
      const invoice = await prisma.invoice.upsert({
        where: { sourceId: sourceId ?? "" },
        update: {
          updatedAt: new Date(),
          metadata: r.metadata ?? undefined,
          extractedData: r.extractedData ?? undefined,
          validatedData: r.validatedData ?? undefined
        },
        create: {
          sourceId,
          invoiceNumber,
          vendorId,
          customerId,
          issueDate: issueDate ?? undefined,
          currency: (summary.currencySymbol?.value && String(summary.currencySymbol.value).trim()) || "EUR",
          subTotal: subTotal,
          taxTotal: taxTotal,
          total: invoiceTotal,
          status: r.validatedData?.status ?? r.status ?? "processed",
          isValidatedByHuman: !!r.isValidatedByHuman,
          processedAt: r.processedAt?.$date ? new Date(r.processedAt.$date) : undefined,
          analyticsId: r.analyticsId ?? undefined,
          metadata: r.metadata ?? undefined,
          extractedData: r.extractedData ?? undefined,
          validatedData: r.validatedData ?? undefined
        } as any
      } as any);

      // create document linking to invoice
      await prisma.document.create({
        data: {
          sourceId,
          fileName,
          filePath,
          fileSize,
          fileType,
          status,
          organizationId: r.organizationId ?? undefined,
          departmentId: r.departmentId ?? undefined,
          uploadedById: r.uploadedById ?? undefined,
          createdAt,
          updatedAt,
          metadata: r.metadata ?? undefined,
          invoiceId: invoice.id
        }
      });

      // create line items
      if (Array.isArray(itemsArr)) {
        for (const it of itemsArr) {
          // item fields could be nested with .value keys
          const desc = it.description?.value ?? it.description ?? it.name ?? null;
          const qty = toNumber(it.quantity?.value ?? it.quantity ?? 1);
          const unit = toNumber(it.unitPrice?.value ?? it.unitPrice ?? it.unitPrice);
          const totalPrice = toNumber(it.totalPrice?.value ?? it.totalPrice ?? it.total);

          await prisma.lineItem.create({
            data: {
              invoiceId: invoice.id,
              description: desc ?? undefined,
              quantity: qty,
              unitPrice: unit,
              totalPrice: totalPrice
            }
          });
        }
      }

      // (payments array rarely present in example) - no payment items in sample
      // if payments exist in r.extractedData.llmData.payment or r.payments etc - map them here
    } catch (err) {
      console.error("Error seeding record", r._id, err);
    }
  }

  console.log("Seeding finished");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
