# Mudir Database

## Source of truth

**Rust migrations** in `src-tauri/src/lib.rs` (`tauri-plugin-sql`) are authoritative for production schema.

**Drizzle** (`src/db/schema.ts`) mirrors the schema for TypeScript types only.

## Do not use `db:push` against production

`drizzle.config.ts` targets `.local/mudir-dev.db` — a separate dev file from Tauri `mudir.db`.

Use `pnpm db:generate` only to refresh Drizzle artifacts after updating `schema.ts`.

## Schema version

Table `schema_meta` stores `version` after migration v9+. Read after restore to validate backup compatibility.

## Migration history

| Version | Description |
|---|---|
| 1–8 | Core tables (products, sales, purchases, expenses, audit) |
| 9+ | Settings, users, catalog pricing, customers, online orders, multi-currency |
