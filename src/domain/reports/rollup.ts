/** تجمیع فروش روزانه از ردیف‌های خام جدول `sales` (بدون state UI). */
export function rollupSalesByDay(
  rows: {
    created_at: string;
    total_amount: number;
    returned_at: string | null | undefined;
  }[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.returned_at) {
      continue;
    }
    const day = r.created_at.slice(0, 10);
    const add = Number(r.total_amount);
    m.set(day, (m.get(day) ?? 0) + add);
  }
  return m;
}

/** سری زمانی برای نمودار: آخرین `dayCount` روز، صفر برای روزهای بدون فروش. */
export function salesMapToChartSeries(
  byDay: Map<string, number>,
  dayCount: number,
  endDate = new Date()
): { day: string; total: number }[] {
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  const series: { day: string; total: number }[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key, total: byDay.get(key) ?? 0 });
  }
  return series;
}

export interface ChannelTotals {
  inStore: number;
  net: number;
  online: number;
  returns: number;
}

/** تجمیع فروش بر اساس کانال (فروش برگشت‌خورده جدا). */
export function rollupSalesByChannel(
  rows: {
    channel: string;
    total_amount: number;
    returned_at: string | null | undefined;
  }[]
): ChannelTotals {
  let inStore = 0;
  let online = 0;
  let returns = 0;
  for (const row of rows) {
    if (row.returned_at) {
      returns += Number(row.total_amount);
      continue;
    }
    if (row.channel === "online") {
      online += Number(row.total_amount);
    } else {
      inStore += Number(row.total_amount);
    }
  }
  return {
    inStore,
    net: inStore + online - returns,
    online,
    returns,
  };
}

export interface PlLiteSummary {
  cogs: number;
  expenses: number;
  net: number;
  revenue: number;
}

export function computePlLite(
  revenue: number,
  cogs: number,
  expenses: number
): PlLiteSummary {
  return {
    cogs,
    expenses,
    net: revenue - cogs - expenses,
    revenue,
  };
}
