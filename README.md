# Mudir (مدیر)

Offline retail management for Afghan **فروشگاه** stores — in-store POS, online orders, inventory, purchases, expenses, and daily reports. Bilingual **Dari (fa-AF)** and **English**, with **AFN** and **USD** support.

## Features (v1.0)

- **In-store sales** (`/pos`) — scan SKU/barcode, multi-currency, branded receipts
- **Online orders** (`/orders`) — phone/WhatsApp/web orders, fulfill to sale
- **Products & inventory** — pricing, low-stock alerts, atomic stock movements
- **Customers** — optional customer on sales and orders
- **Purchases & suppliers** — receive stock, track costs
- **Expenses** — daily operating costs (no cash-session/shift UI in v1.0)
- **Reports & dashboard** — channel split, P&L lite, top products, stock value
- **Settings** — store profile, locale, exchange rate, safe backup/restore
- **Offline-first** — SQLite on a single Windows PC via Tauri 2

## Tech stack

- **UI:** Next.js 16 (static export) + React 19 + shadcn/ui + Tailwind CSS 4
- **Desktop:** Tauri 2 + `tauri-plugin-sql` (Rust migrations are authoritative)
- **Data:** UI → Bridge → Domain → SQLite

See [`docs/brand-book.md`](docs/brand-book.md) and [`docs/database.md`](docs/database.md).

## Prerequisites (Windows)

- Node.js + [pnpm](https://pnpm.io/)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) — Rust (MSVC), Visual Studio C++ build tools, WebView2

## Development

```shell
pnpm install
pnpm tauri dev
```

Next.js alone (browser preview, no SQLite):

```shell
pnpm dev:next
```

## Scripts

| Command | Description |
|---|---|
| `pnpm tauri dev` | Run Mudir in a Tauri window |
| `pnpm tauri build` | Build Windows installer (v1.0.0) |
| `pnpm test` | Vitest (domain, format, bridge SQL checks) |
| `pnpm lint` | Biome check |
| `pnpm db:generate` | Refresh Drizzle artifacts from `schema.ts` |

**Do not** run `pnpm db:push` against production `mudir.db`. Rust migrations in `src-tauri/src/lib.rs` own the schema.

## First run

1. Complete the onboarding wizard (store name, locale, USD→AFN rate).
2. Default owner PIN is seeded as `1234` — change in a future release.
3. Add products, then sell from POS or create online orders.

## Backup & restore

Settings → Backup uses SQLite's online backup API. Restore validates schema version, saves a pre-restore copy (`mudir.pre-restore-*.db`), then replaces the active database. **Restart Mudir** after restore.

## License

MIT
