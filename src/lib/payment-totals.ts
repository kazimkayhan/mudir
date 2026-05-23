import { type CurrencyCode, roundMoney } from "@/lib/format";

export interface PaymentDraft {
  amount: number;
  currencyCode: CurrencyCode;
  method: string;
}

/** Sum payment rows converted into the sale's currency using the stored exchange rate. */
export function sumPaymentsInSaleCurrency(
  payments: PaymentDraft[],
  saleCurrency: CurrencyCode,
  usdToAfnRate: number
): number {
  let total = 0;
  for (const payment of payments) {
    if (payment.currencyCode === saleCurrency) {
      total += payment.amount;
      continue;
    }
    if (saleCurrency === "AFN" && payment.currencyCode === "USD") {
      total += payment.amount * usdToAfnRate;
      continue;
    }
    if (
      saleCurrency === "USD" &&
      payment.currencyCode === "AFN" &&
      usdToAfnRate > 0
    ) {
      total += payment.amount / usdToAfnRate;
    }
  }
  return roundMoney(total);
}
