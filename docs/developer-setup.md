# Developer setup

## License (local development)

Mudir requires a subscription license key. For local development:

1. **Local builds** (`pnpm dev` or `pnpm tauri build`): use the built-in dev key:
   ```
   MUDIR-DEV-LOCAL-NOT-FOR-RESALE
   ```

   This works in debug and release builds while the `dev-license` Cargo feature is enabled (on by default). For customer installers, build with `--no-default-features` so the dev key is rejected.

2. **Issue a signed license** (requires private key):
   ```bash
   # Place your private key hex in .license/private.hex (gitignored)
   pnpm issue-license --email dev@local --days 3650
   ```

Generate a new keypair once (keep private key secret):

```bash
node -e "import * as ed from '@noble/ed25519'; const s=ed.utils.randomSecretKey(); const p=await ed.getPublicKeyAsync(s); console.log('PRIVATE', Buffer.from(s).toString('hex')); console.log('PUBLIC', Buffer.from(p).toString('hex'));"
```

Embed the **public** key in `src-tauri/src/license.rs`. Store the **private** key in `.license/private.hex`.

## First-run flow

1. `/activate` — license key
2. `/welcome` — language + theme
3. `/setup` — company profile + owner account
4. `/login` — sign in (no auto-login after setup)

## Backups

Daily backups are written to `Documents/Mudir Backups/` as `.mudir-backup` zip files (database + company assets + license).

## Google Drive backup (optional)

Users can connect Google Drive in **Settings → Google Drive** to upload backups to a folder named `Mudir Backups`.

### Google Cloud setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API**.
3. Configure **OAuth consent screen** (External or Internal for Workspace).
4. Create **OAuth client ID** → Application type: **Desktop app**.
5. Add authorized redirect URI: `http://127.0.0.1:8765/callback`
6. Copy the client ID (ends with `.apps.googleusercontent.com`) and paste it in Mudir settings when connecting.

The app uses scope `drive.file` (only files created by Mudir). Tokens are stored locally in AppData as `google-drive-auth.json`.

During OAuth, Mudir opens the browser and listens on localhost port **8765** for the callback. Ensure that port is free.
