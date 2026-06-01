# Mudir brand assets

| File | Use |
|---|---|
| `logo.png` | App UI wordmark (sidebar, login, onboarding) |
| `logo-icon.png` | Square source for `pnpm tauri icon` (auto-generated) |

See [`docs/brand-book.md`](../../docs/brand-book.md) for colors, typography, and bilingual naming (**مدیر — Mudir**, **فروشگاه** not مغازه).

After updating `logo.png`, regenerate app and installer assets:

```shell
pnpm brand:icons
pnpm tauri build
```

The web UI uses `public/brand/logo.png`. The Windows installer uses separate files in `src-tauri/icons/` (`icon.ico`, `installer-sidebar.bmp`, `installer-header.bmp`).
