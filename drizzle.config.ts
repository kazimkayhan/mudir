import { defineConfig } from "drizzle-kit";

/** Dev-only mirror of schema.ts — production uses Rust migrations in src-tauri/src/lib.rs. Never db:push against mudir.db. */
export default defineConfig({
  dbCredentials: {
    url: "file:./.local/mudir-dev.db",
  },
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./src/db/schema.ts",
});
