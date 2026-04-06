// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//
// قرارداد پیشنهادی پاسخ برای عملیات حساس (هم‌راستا با پلان): از `Result<T, String>` یا
// نوع خطای ساخت‌یافته استفاده کنید تا فرانت بتواند `{ ok, code?, message? }` را map کند؛
// فعلاً `greet` فقط نمونه است.
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(serde::Serialize)]
struct DataLayerPing {
  ok: bool,
  message: String,
}

#[tauri::command]
fn ping_data_layer() -> DataLayerPing {
  DataLayerPing {
    ok: true,
    message: "sqlite-plugin-ready".into(),
  }
}

#[tauri::command]
fn greet() -> String {
  let now = SystemTime::now();
  let epoch_ms = now
    .duration_since(UNIX_EPOCH)
    .map_or(0, |duration| duration.as_millis());
  format!("Hello world from Rust! Current epoch: {epoch_ms}")
}

fn resolve_mudir_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .resolve("mudir.db", tauri::path::BaseDirectory::AppConfig)
    .map_err(|e| format!("resolve mudir.db: {e}"))
}

/// کپی `mudir.db` از مسیر `AppConfig` به مسیر انتخاب‌شده توسط کاربر.
#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
fn backup_mudir_database(app: tauri::AppHandle, dest_path: String) -> Result<(), String> {
  let src = resolve_mudir_db_path(&app)?;
  if !src.exists() {
    return Err("Database file does not exist yet.".into());
  }
  std::fs::copy(&src, dest_path).map_err(|e| e.to_string())?;
  Ok(())
}

/// جایگزینی `mudir.db` از فایل پشتیبان. پس از آن اپ را ببندید و دوباره باز کنید.
#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
fn restore_mudir_database(app: tauri::AppHandle, src_path: String) -> Result<(), String> {
  let src = PathBuf::from(src_path);
  if !src.exists() {
    return Err("Backup file not found.".into());
  }
  let dest = resolve_mudir_db_path(&app)?;
  std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
  Ok(())
}

/// اجرای حلقهٔ رویداد Tauri.
///
/// # Errors
/// در صورت شکست راه‌اندازی یا اجرای runtime برمی‌گردد.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
  let sql_migrations = vec![
    Migration {
      version: 1,
      description: "init_products",
      sql: "CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      on_hand_qty INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "stock_movements",
      sql: "CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity_delta INTEGER NOT NULL,
      ref_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "idx_stock_movements_product",
      sql: "CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "idx_stock_movements_created",
      sql: "CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 5,
      description: "sales_pos",
      sql: "CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      cashier_id TEXT NOT NULL,
      customer_id TEXT,
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      change_amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 6,
      description: "sales_returned_at",
      sql: "ALTER TABLE sales ADD COLUMN returned_at TEXT;",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 7,
      description: "purchases_finance",
      sql: "CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY NOT NULL,
      supplier_id TEXT,
      reference TEXT,
      total_cost REAL NOT NULL,
      notes TEXT,
      cashier_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS purchase_lines (
      id TEXT PRIMARY KEY NOT NULL,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at);
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at);
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_balance REAL NOT NULL DEFAULT 0,
      closing_balance REAL,
      note TEXT
    );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 8,
      description: "audit_logs",
      sql: "CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);",
      kind: MigrationKind::Up,
    },
  ];

  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:mudir.db", sql_migrations)
        .build(),
    )
    .invoke_handler(tauri::generate_handler![
      greet,
      ping_data_layer,
      backup_mudir_database,
      restore_mudir_database,
    ])
    .run(tauri::generate_context!())
}
