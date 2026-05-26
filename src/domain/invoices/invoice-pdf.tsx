import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { InvoiceRow } from "@/bridge/invoices";
import type { BusinessSettings } from "@/bridge/settings";

export interface InvoicePdfItem {
  id: string;
  product_name: string | null;
  quantity: number;
  unit_price: number;
}

interface InvoicePdfProps {
  customerName: string;
  invoice: InvoiceRow;
  items: InvoicePdfItem[];
  locale: "en" | "fa-AF";
  logoSrc?: string | null;
  settings: BusinessSettings;
  signatureSrc?: string | null;
  stampSrc?: string | null;
}

const styles = StyleSheet.create({
  accentBar: {
    backgroundColor: "#0891b2",
    height: 4,
    marginBottom: 16,
  },
  footer: {
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    color: "#6b7280",
    fontSize: 9,
    marginTop: 24,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    color: "#6b7280",
    fontSize: 9,
    marginBottom: 2,
  },
  logo: {
    height: 56,
    objectFit: "contain",
    width: 120,
  },
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  signatureImage: {
    height: 48,
    objectFit: "contain",
    width: 96,
  },
  signatureRow: {
    flexDirection: "row",
    gap: 24,
    justifyContent: "flex-end",
    marginTop: 24,
  },
  tableCell: {
    flex: 1,
    padding: 6,
  },
  tableHead: {
    backgroundColor: "#f3f4f6",
    flexDirection: "row",
    fontWeight: "bold",
  },
  tableRow: {
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    flexDirection: "row",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
});

function money(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })} ${currency}`;
}

function footerText(
  settings: BusinessSettings,
  locale: "en" | "fa-AF"
): string {
  if (locale === "fa-AF") {
    return settings.invoiceFooterFa ?? settings.invoiceFooterEn ?? "";
  }
  return settings.invoiceFooterEn ?? settings.invoiceFooterFa ?? "";
}

export function InvoicePdfDocument({
  customerName,
  invoice,
  items,
  locale,
  logoSrc,
  settings,
  signatureSrc,
  stampSrc,
}: InvoicePdfProps) {
  const accent = settings.pdfAccentColor || "#0891b2";
  const company =
    settings.tradeName ?? settings.legalName ?? settings.storeName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{company}</Text>
            {settings.legalName && settings.legalName !== company ? (
              <Text>{settings.legalName}</Text>
            ) : null}
            {settings.streetAddress || settings.address ? (
              <Text>{settings.streetAddress ?? settings.address}</Text>
            ) : null}
            {settings.phone ? <Text>{settings.phone}</Text> : null}
            {settings.importLicenseNumber ? (
              <Text>{`Import license: ${settings.importLicenseNumber}`}</Text>
            ) : null}
          </View>
          {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
        </View>

        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Invoice</Text>
            <Text>{invoice.invoice_number}</Text>
          </View>
          <View>
            <Text style={styles.label}>Date</Text>
            <Text>{invoice.issue_date ?? invoice.created_at.slice(0, 10)}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 16, marginTop: 12 }}>
          <Text style={styles.label}>Bill to</Text>
          <Text>{customerName}</Text>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Item</Text>
          <Text style={styles.tableCell}>Qty</Text>
          <Text style={styles.tableCell}>Price</Text>
          <Text style={styles.tableCell}>Total</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>
              {item.product_name ?? "—"}
            </Text>
            <Text style={styles.tableCell}>{item.quantity}</Text>
            <Text style={styles.tableCell}>
              {money(item.unit_price, invoice.currency_code)}
            </Text>
            <Text style={styles.tableCell}>
              {money(item.quantity * item.unit_price, invoice.currency_code)}
            </Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text>
            {`Subtotal: ${money(invoice.subtotal, invoice.currency_code)}`}
          </Text>
        </View>
        {invoice.discount_amount > 0 ? (
          <View style={styles.totalRow}>
            <Text>
              {`Discount: ${money(invoice.discount_amount, invoice.currency_code)}`}
            </Text>
          </View>
        ) : null}
        {invoice.tax_amount > 0 ? (
          <View style={styles.totalRow}>
            <Text>
              {`Tax: ${money(invoice.tax_amount, invoice.currency_code)}`}
            </Text>
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={{ fontWeight: "bold" }}>
            {`Total: ${money(invoice.total_amount, invoice.currency_code)}`}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text>
            {`Paid: ${money(invoice.amount_paid, invoice.currency_code)} · Balance: ${money(invoice.balance_due, invoice.currency_code)}`}
          </Text>
        </View>

        {invoice.notes ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        {stampSrc || signatureSrc ? (
          <View style={styles.signatureRow}>
            {stampSrc ? (
              <Image src={stampSrc} style={styles.signatureImage} />
            ) : null}
            {signatureSrc ? (
              <Image src={signatureSrc} style={styles.signatureImage} />
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footer}>{footerText(settings, locale)}</Text>
      </Page>
    </Document>
  );
}
