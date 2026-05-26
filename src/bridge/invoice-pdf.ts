import { pdf } from "@react-pdf/renderer";
import { readFileAsDataUrl } from "@/bridge/file-data-url";
import { getInvoiceById, getInvoiceItems } from "@/bridge/invoices";
import { getBusinessSettings } from "@/bridge/settings";
import { InvoicePdfDocument } from "@/domain/invoices/invoice-pdf";

export async function exportInvoicePdf(
  invoiceId: string,
  locale: "en" | "fa-AF"
): Promise<void> {
  const [invoice, items, settings] = await Promise.all([
    getInvoiceById(invoiceId),
    getInvoiceItems(invoiceId),
    getBusinessSettings(),
  ]);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const [logoSrc, stampSrc, signatureSrc] = await Promise.all([
    readFileAsDataUrl(settings.logoPath),
    readFileAsDataUrl(settings.stampPath),
    readFileAsDataUrl(settings.signaturePath),
  ]);

  const blob = await pdf(
    InvoicePdfDocument({
      customerName: invoice.customer_name ?? "—",
      invoice,
      items,
      locale,
      logoSrc,
      settings,
      signatureSrc,
      stampSrc,
    })
  ).toBlob();

  const fileName = `${invoice.invoice_number.replace(/[^\w-]+/g, "-")}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
