# Mudir brand assets

Optional marketing and receipt assets for Mudir v1.0. The app ships with Tauri default icons until custom artwork is added here.

## Recommended files

| File | Use |
|---|---|
| `logo.svg` | Sidebar, onboarding, receipts |
| `logo-mark.svg` | Favicon, app icon source |
| `receipt-header.png` | 80mm thermal receipt header (optional) |

## Guidelines

See [`docs/brand-book.md`](../../docs/brand-book.md) for colors, typography, and bilingual naming (**مدیر — Mudir**, **فروشگاه** not مغازه).

After adding `logo-mark.svg`, regenerate Tauri icons:

```shell
pnpm tauri icon public/brand/logo-mark.svg
```
