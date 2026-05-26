// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//
// قرارداد پیشنهادی پاسخ برای عملیات حساس (هم‌راستا با پلان): از `Result<T, String>` یا
// نوع خطای ساخت‌یافته استفاده کنید تا فرانت بتواند `{ ok, code?, message? }` را map کند؛
// فعلاً `greet` فقط نمونه است.
mod backup;
mod google_drive;
mod license;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use base64::Engine;
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
fn copy_company_asset(
  app: tauri::AppHandle,
  source_path: String,
  file_name: String,
) -> Result<String, String> {
  let company_dir = app
    .path()
    .resolve("company", tauri::path::BaseDirectory::AppData)
    .map_err(|e| format!("resolve company dir: {e}"))?;
  std::fs::create_dir_all(&company_dir).map_err(|e| format!("create company dir: {e}"))?;
  let dest = company_dir.join(&file_name);
  std::fs::copy(&source_path, &dest).map_err(|e| format!("copy asset: {e}"))?;
  Ok(dest.to_string_lossy().into_owned())
}

fn mime_for_path(path: &Path) -> &'static str {
  match path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(str::to_ascii_lowercase)
    .as_deref()
  {
    Some("jpg") | Some("jpeg") => "image/jpeg",
    Some("webp") => "image/webp",
    Some("pdf") => "application/pdf",
    _ => "image/png",
  }
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
  let file_path = Path::new(&path);
  if !file_path.exists() {
    return Err("File not found".into());
  }
  let bytes = std::fs::read(file_path).map_err(|e| format!("read file: {e}"))?;
  let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
  Ok(format!("data:{};base64,{encoded}", mime_for_path(file_path)))
}

#[tauri::command]
fn copy_product_asset(
  app: tauri::AppHandle,
  product_id: String,
  source_path: String,
  file_name: String,
) -> Result<String, String> {
  let product_dir = app
    .path()
    .resolve(
      format!("products/{product_id}"),
      tauri::path::BaseDirectory::AppData,
    )
    .map_err(|e| format!("resolve product dir: {e}"))?;
  std::fs::create_dir_all(&product_dir).map_err(|e| format!("create product dir: {e}"))?;
  let dest = product_dir.join(&file_name);
  std::fs::copy(&source_path, &dest).map_err(|e| format!("copy product asset: {e}"))?;
  Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
fn greet() -> String {
  let now = SystemTime::now();
  let epoch_ms = now
    .duration_since(UNIX_EPOCH)
    .map_or(0, |duration| duration.as_millis());
  format!("Hello world from Rust! Current epoch: {epoch_ms}")
}

pub(crate) fn resolve_mudir_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .resolve("mudir.db", tauri::path::BaseDirectory::AppConfig)
    .map_err(|e| format!("resolve mudir.db: {e}"))
}

pub(crate) const EXPECTED_SCHEMA_VERSION: i64 = 24;

pub(crate) fn read_schema_version(db_path: &PathBuf) -> Result<i64, String> {
  if !db_path.exists() {
    return Ok(8);
  }
  let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
  let mut stmt = conn
    .prepare("SELECT value FROM schema_meta WHERE key = 'version'")
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
  if let Some(row) = rows.next().map_err(|e| e.to_string())? {
    let value: String = row.get(0).map_err(|e| e.to_string())?;
    return value.parse::<i64>().map_err(|e| e.to_string());
  }
  Ok(8)
}

pub(crate) fn sqlite_backup_to(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
  let src_conn = rusqlite::Connection::open(src).map_err(|e| e.to_string())?;
  let mut dest_conn = rusqlite::Connection::open(dest).map_err(|e| e.to_string())?;
  let backup = rusqlite::backup::Backup::new(&src_conn, &mut dest_conn)
    .map_err(|e| e.to_string())?;
  backup
    .run_to_completion(500, std::time::Duration::from_millis(250), None)
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// کپی `mudir.db` از مسیر `AppConfig` به مسیر انتخاب‌شده توسط کاربر.
#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
fn backup_mudir_database(app: tauri::AppHandle, dest_path: String) -> Result<(), String> {
  let src = resolve_mudir_db_path(&app)?;
  if !src.exists() {
    return Err("Database file does not exist yet.".into());
  }
  sqlite_backup_to(&src, &PathBuf::from(dest_path))?;
  Ok(())
}

/// جایگزینی `mudir.db` از فایل پشتیبان. پس از آن اپ را ببندید و دوباره باز کنید.
#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
fn restore_mudir_database(app: tauri::AppHandle, src_path: String) -> Result<(), String> {
  let src = PathBuf::from(&src_path);
  if !src.exists() {
    return Err("Backup file not found.".into());
  }
  let version = read_schema_version(&src)?;
  if version > EXPECTED_SCHEMA_VERSION {
    return Err(format!(
      "Backup schema version {version} is newer than this app (v{EXPECTED_SCHEMA_VERSION}). Update Mudir first."
    ));
  }
  let dest = resolve_mudir_db_path(&app)?;
  if dest.exists() {
    let epoch_ms = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map_or(0, |duration| duration.as_millis());
    let pre_restore = dest.with_extension(format!("pre-restore-{epoch_ms}.db"));
    sqlite_backup_to(&dest, &pre_restore)?;
  }
  sqlite_backup_to(&src, &dest)?;
  Ok(())
}

#[tauri::command]
fn get_license_status(app: tauri::AppHandle) -> license::LicenseStatus {
  license::get_license_status(&app)
}

#[tauri::command]
fn activate_license(app: tauri::AppHandle, key: String) -> Result<license::LicenseStatus, String> {
  license::activate_license(&app, key)
}

#[tauri::command]
fn clear_license(app: tauri::AppHandle) -> Result<(), String> {
  license::clear_license(&app)
}

#[tauri::command]
fn create_mudir_backup_bundle(
  app: tauri::AppHandle,
  dest_path: String,
  company_name: String,
) -> Result<(), String> {
  backup::create_mudir_backup_bundle(&app, Path::new(&dest_path), "manual", &company_name)
}

#[tauri::command]
fn restore_mudir_backup_bundle(app: tauri::AppHandle, src_path: String) -> Result<(), String> {
  backup::restore_mudir_backup_bundle(&app, Path::new(&src_path))
}

#[tauri::command]
fn run_daily_backup_if_needed(
  app: tauri::AppHandle,
  company_name: String,
) -> Result<Option<String>, String> {
  backup::run_daily_backup_if_needed(&app, &company_name)
}

#[tauri::command]
fn get_backup_status(app: tauri::AppHandle) -> Result<backup::BackupStatus, String> {
  backup::get_backup_status(&app)
}

#[tauri::command]
fn set_auto_daily_backup(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
  backup::set_auto_daily_backup(&app, enabled)
}

#[tauri::command]
fn open_backup_folder(app: tauri::AppHandle) -> Result<(), String> {
  backup::open_backup_folder(&app)
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
    Migration {
      version: 9,
      description: "settings_and_schema_meta",
      sql: "CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO schema_meta (key, value) VALUES ('version', '16');
    CREATE TABLE IF NOT EXISTS business_settings (
      id TEXT PRIMARY KEY NOT NULL,
      store_name TEXT NOT NULL DEFAULT '',
      address TEXT,
      phone TEXT,
      default_locale TEXT NOT NULL DEFAULT 'fa-AF',
      base_currency TEXT NOT NULL DEFAULT 'AFN',
      usd_to_afn_rate REAL NOT NULL DEFAULT 70,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id TEXT PRIMARY KEY NOT NULL,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      effective_at TEXT NOT NULL
    );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 10,
      description: "users",
      sql: "CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 11,
      description: "product_pricing",
      sql: "ALTER TABLE products ADD COLUMN sale_price REAL NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN currency TEXT NOT NULL DEFAULT 'AFN';
    ALTER TABLE products ADD COLUMN barcode TEXT;
    ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL AND sku != '';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 12,
      description: "customers",
      sql: "CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 13,
      description: "sales_multichannel",
      sql: "ALTER TABLE sales ADD COLUMN channel TEXT NOT NULL DEFAULT 'in_store';
    ALTER TABLE sales ADD COLUMN order_id TEXT;
    ALTER TABLE sales ADD COLUMN operator_id TEXT;
    ALTER TABLE sales ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'AFN';
    ALTER TABLE sales ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 1;
    UPDATE sales SET operator_id = cashier_id WHERE operator_id IS NULL;",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 14,
      description: "payments_extended",
      sql: "ALTER TABLE payments ADD COLUMN method TEXT NOT NULL DEFAULT 'cash';
    ALTER TABLE payments ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'AFN';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 15,
      description: "purchases_expenses_extended",
      sql: "ALTER TABLE purchases ADD COLUMN operator_id TEXT;
    ALTER TABLE purchases ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'AFN';
    ALTER TABLE purchases ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 1;
    UPDATE purchases SET operator_id = cashier_id WHERE operator_id IS NULL;
    ALTER TABLE expenses ADD COLUMN operator_id TEXT;
    ALTER TABLE expenses ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'AFN';
    ALTER TABLE expenses ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 1;
    ALTER TABLE stock_movements ADD COLUMN operator_id TEXT;",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 16,
      description: "online_orders",
      sql: "CREATE TABLE IF NOT EXISTS online_orders (
      id TEXT PRIMARY KEY NOT NULL,
      customer_id TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      delivery_note TEXT,
      currency_code TEXT NOT NULL DEFAULT 'AFN',
      exchange_rate REAL NOT NULL DEFAULT 1,
      operator_id TEXT NOT NULL,
      external_ref TEXT,
      sale_id TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS online_order_items (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
    CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON online_order_items(order_id);",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 17,
      description: "product_condition",
      sql: "ALTER TABLE products ADD COLUMN condition TEXT NOT NULL DEFAULT 'new';
    UPDATE schema_meta SET value = '17' WHERE key = 'version';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 18,
      description: "auth_and_company_profile",
      sql: "ALTER TABLE users ADD COLUMN email TEXT;
    ALTER TABLE users ADD COLUMN password_hash TEXT;
    ALTER TABLE users ADD COLUMN last_login_at TEXT;
    ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email != '';
    ALTER TABLE business_settings ADD COLUMN legal_name TEXT;
    ALTER TABLE business_settings ADD COLUMN trade_name TEXT;
    ALTER TABLE business_settings ADD COLUMN email TEXT;
    ALTER TABLE business_settings ADD COLUMN website TEXT;
    ALTER TABLE business_settings ADD COLUMN province TEXT;
    ALTER TABLE business_settings ADD COLUMN city TEXT;
    ALTER TABLE business_settings ADD COLUMN street_address TEXT;
    ALTER TABLE business_settings ADD COLUMN import_license_number TEXT;
    ALTER TABLE business_settings ADD COLUMN business_registration_number TEXT;
    ALTER TABLE business_settings ADD COLUMN business_type TEXT NOT NULL DEFAULT 'importer_reseller';
    ALTER TABLE business_settings ADD COLUMN logo_path TEXT;
    ALTER TABLE business_settings ADD COLUMN stamp_path TEXT;
    ALTER TABLE business_settings ADD COLUMN signature_path TEXT;
    ALTER TABLE business_settings ADD COLUMN pdf_accent_color TEXT DEFAULT '#0891b2';
    ALTER TABLE business_settings ADD COLUMN invoice_footer_fa TEXT;
    ALTER TABLE business_settings ADD COLUMN invoice_footer_en TEXT;
    ALTER TABLE business_settings ADD COLUMN invoice_prefix TEXT DEFAULT 'INV-';
    ALTER TABLE business_settings ADD COLUMN next_invoice_number INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE business_settings ADD COLUMN proforma_prefix TEXT DEFAULT 'PRO-';
    ALTER TABLE business_settings ADD COLUMN next_proforma_number INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE business_settings ADD COLUMN payment_receipt_prefix TEXT DEFAULT 'RCP-';
    ALTER TABLE business_settings ADD COLUMN default_payment_terms_days INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE business_settings ADD COLUMN stock_deduct_on_invoice TEXT NOT NULL DEFAULT 'issue';
    UPDATE schema_meta SET value = '18' WHERE key = 'version';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 19,
      description: "product_catalog",
      sql: "CREATE TABLE IF NOT EXISTS product_categories (
      id TEXT PRIMARY KEY NOT NULL,
      name_fa TEXT NOT NULL,
      name_en TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      country TEXT,
      website TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS manufacturers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      country TEXT,
      created_at TEXT NOT NULL
    );
    ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'consumable';
    ALTER TABLE products ADD COLUMN category_id TEXT;
    ALTER TABLE products ADD COLUMN brand_id TEXT;
    ALTER TABLE products ADD COLUMN manufacturer_id TEXT;
    ALTER TABLE products ADD COLUMN model_number TEXT;
    ALTER TABLE products ADD COLUMN country_of_origin TEXT;
    ALTER TABLE products ADD COLUMN tracking_mode TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE products ADD COLUMN unit_of_measure TEXT NOT NULL DEFAULT 'piece';
    ALTER TABLE products ADD COLUMN warranty_months INTEGER;
    ALTER TABLE products ADD COLUMN hs_code TEXT;
    ALTER TABLE products ADD COLUMN default_duty_rate REAL;
    ALTER TABLE products ADD COLUMN description TEXT;
    ALTER TABLE products ADD COLUMN specs_json TEXT;
    ALTER TABLE products ADD COLUMN requires_license INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN min_sale_qty INTEGER NOT NULL DEFAULT 1;
    UPDATE schema_meta SET value = '19' WHERE key = 'version';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 20,
      description: "inventory_batches",
      sql: "CREATE TABLE IF NOT EXISTS inventory_batches (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      serial_number TEXT,
      lot_number TEXT,
      expiry_date TEXT,
      qty_on_hand INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      purchase_line_id TEXT,
      received_at TEXT NOT NULL,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_batches_product ON inventory_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON inventory_batches(expiry_date);
    ALTER TABLE stock_movements ADD COLUMN batch_id TEXT;
    CREATE TABLE IF NOT EXISTS sale_item_batches (
      id TEXT PRIMARY KEY NOT NULL,
      sale_item_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
    UPDATE schema_meta SET value = '20' WHERE key = 'version';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 21,
      description: "b2b_customers",
      sql: "ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'other';
    ALTER TABLE customers ADD COLUMN business_name TEXT;
    ALTER TABLE customers ADD COLUMN contact_person TEXT;
    ALTER TABLE customers ADD COLUMN license_number TEXT;
    ALTER TABLE customers ADD COLUMN specialty TEXT;
    ALTER TABLE customers ADD COLUMN province TEXT;
    ALTER TABLE customers ADD COLUMN city TEXT;
    ALTER TABLE customers ADD COLUMN street_address TEXT;
    ALTER TABLE customers ADD COLUMN email TEXT;
    ALTER TABLE customers ADD COLUMN tax_id TEXT;
    ALTER TABLE customers ADD COLUMN default_discount_pct REAL NOT NULL DEFAULT 0;
    ALTER TABLE customers ADD COLUMN preferred_currency TEXT DEFAULT 'AFN';
    ALTER TABLE customers ADD COLUMN payment_terms_days INTEGER;
    ALTER TABLE customers ADD COLUMN credit_limit REAL;
    ALTER TABLE customers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
    UPDATE schema_meta SET value = '21' WHERE key = 'version';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 22,
      description: "invoices_ar",
      sql: "CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_number TEXT NOT NULL,
      document_type TEXT NOT NULL DEFAULT 'invoice',
      customer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      issue_date TEXT,
      due_date TEXT,
      currency_code TEXT NOT NULL DEFAULT 'AFN',
      exchange_rate REAL NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      notes TEXT,
      terms_text TEXT,
      sale_id TEXT,
      operator_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'AFN',
      exchange_rate REAL NOT NULL DEFAULT 1,
      method TEXT NOT NULL DEFAULT 'cash',
      payment_date TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      operator_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoice_item_batches (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_item_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    UPDATE schema_meta SET value = '22' WHERE key = 'version';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 23,
      description: "import_ap",
      sql: "ALTER TABLE suppliers ADD COLUMN country TEXT;
    ALTER TABLE suppliers ADD COLUMN currency TEXT DEFAULT 'USD';
    ALTER TABLE suppliers ADD COLUMN email TEXT;
    ALTER TABLE suppliers ADD COLUMN address TEXT;
    ALTER TABLE suppliers ADD COLUMN lead_time_days INTEGER;
    ALTER TABLE suppliers ADD COLUMN bank_details TEXT;
    CREATE TABLE IF NOT EXISTS import_shipments (
      id TEXT PRIMARY KEY NOT NULL,
      reference TEXT NOT NULL,
      supplier_id TEXT,
      foreign_invoice_ref TEXT,
      origin_country TEXT,
      arrival_date TEXT,
      customs_declaration_no TEXT,
      status TEXT NOT NULL DEFAULT 'in_transit',
      freight_cost REAL NOT NULL DEFAULT 0,
      insurance_cost REAL NOT NULL DEFAULT 0,
      customs_duty REAL NOT NULL DEFAULT 0,
      clearance_fees REAL NOT NULL DEFAULT 0,
      other_costs REAL NOT NULL DEFAULT 0,
      currency_code TEXT NOT NULL DEFAULT 'USD',
      exchange_rate REAL NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    ALTER TABLE purchases ADD COLUMN import_shipment_id TEXT;
    ALTER TABLE purchases ADD COLUMN status TEXT NOT NULL DEFAULT 'received';
    ALTER TABLE purchases ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN balance_due REAL NOT NULL DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN due_date TEXT;
    ALTER TABLE purchases ADD COLUMN supplier_invoice_ref TEXT;
    CREATE TABLE IF NOT EXISTS purchase_payments (
      id TEXT PRIMARY KEY NOT NULL,
      purchase_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'USD',
      exchange_rate REAL NOT NULL DEFAULT 1,
      method TEXT NOT NULL DEFAULT 'bank_transfer',
      payment_date TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      operator_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_shipment_payments (
      id TEXT PRIMARY KEY NOT NULL,
      import_shipment_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'USD',
      exchange_rate REAL NOT NULL DEFAULT 1,
      method TEXT NOT NULL DEFAULT 'bank_transfer',
      payment_date TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      operator_id TEXT,
      created_at TEXT NOT NULL
    );
    UPDATE schema_meta SET value = '23' WHERE key = 'version';",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 24,
      description: "product_documents_kits",
      sql: "CREATE TABLE IF NOT EXISTS product_kit_items (
      id TEXT PRIMARY KEY NOT NULL,
      kit_product_id TEXT NOT NULL,
      component_product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS product_related (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      related_product_id TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'accessory'
    );
    CREATE TABLE IF NOT EXISTS product_documents (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    UPDATE schema_meta SET value = '24' WHERE key = 'version';",
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
      copy_company_asset,
      copy_product_asset,
      read_file_base64,
      backup_mudir_database,
      restore_mudir_database,
      get_license_status,
      activate_license,
      clear_license,
      create_mudir_backup_bundle,
      restore_mudir_backup_bundle,
      run_daily_backup_if_needed,
      get_backup_status,
      set_auto_daily_backup,
      open_backup_folder,
      google_drive::connect_google_drive,
      google_drive::disconnect_google_drive,
      google_drive::get_google_drive_status,
      google_drive::set_google_drive_auto_upload,
      google_drive::upload_backup_to_google_drive,
    ])
    .run(tauri::generate_context!())
}
