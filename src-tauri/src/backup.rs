use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::{
  read_schema_version, resolve_app_data_root, resolve_mudir_db_path, sqlite_backup_to,
  EXPECTED_SCHEMA_VERSION,
};

const BACKUP_EXT: &str = "mudir-backup";
const KEEP_DAYS: i64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupManifest {
  format: u8,
  app_version: String,
  schema_version: i64,
  created_at: String,
  company_name: String,
  trigger: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LastBackupMeta {
  path: String,
  created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupPreferences {
  auto_daily: bool,
}

impl Default for BackupPreferences {
  fn default() -> Self {
    Self { auto_daily: true }
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
  pub dir: String,
  pub last_backup_at: Option<String>,
  pub last_backup_path: Option<String>,
  pub today_exists: bool,
  pub auto_enabled: bool,
}

fn app_data_path(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
  Ok(resolve_app_data_root(app)?.join(file_name))
}

fn company_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  Ok(resolve_app_data_root(app)?.join("company"))
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  Ok(resolve_app_data_root(app)?.join("backups"))
}

fn today_backup_name() -> String {
  let date = Local::now().format("%Y-%m-%d");
  format!("mudir-backup-{date}.{BACKUP_EXT}")
}

fn load_preferences(app: &tauri::AppHandle) -> BackupPreferences {
  let path = app_data_path(app, "backup-preferences.json").ok();
  let Some(path) = path else {
    return BackupPreferences::default();
  };
  let Ok(raw) = std::fs::read_to_string(path) else {
    return BackupPreferences::default();
  };
  serde_json::from_str(&raw).unwrap_or_default()
}

fn save_preferences(app: &tauri::AppHandle, prefs: &BackupPreferences) -> Result<(), String> {
  let path = app_data_path(app, "backup-preferences.json")?;
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
  std::fs::write(path, json).map_err(|e| e.to_string())
}

fn save_last_backup(app: &tauri::AppHandle, path: &Path, created_at: &str) -> Result<(), String> {
  let meta = LastBackupMeta {
    path: path.to_string_lossy().into_owned(),
    created_at: created_at.to_string(),
  };
  let file = app_data_path(app, "last-backup.json")?;
  if let Some(parent) = file.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
  std::fs::write(file, json).map_err(|e| e.to_string())
}

fn load_last_backup(app: &tauri::AppHandle) -> Option<LastBackupMeta> {
  let path = app_data_path(app, "last-backup.json").ok()?;
  let raw = std::fs::read_to_string(path).ok()?;
  serde_json::from_str(&raw).ok()
}

fn add_dir_to_zip(
  writer: &mut ZipWriter<File>,
  dir: &Path,
  prefix: &str,
  options: SimpleFileOptions,
) -> Result<(), String> {
  if !dir.exists() {
    return Ok(());
  }
  for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if path.is_file() {
      let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("invalid file name")?;
      let zip_path = format!("{prefix}/{name}");
      writer
        .start_file(zip_path, options)
        .map_err(|e| e.to_string())?;
      let mut file = File::open(&path).map_err(|e| e.to_string())?;
      let mut buffer = Vec::new();
      file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
      writer.write_all(&buffer).map_err(|e| e.to_string())?;
    }
  }
  Ok(())
}

pub fn create_mudir_backup_bundle(
  app: &tauri::AppHandle,
  dest_path: &Path,
  trigger: &str,
  company_name: &str,
) -> Result<(), String> {
  let src_db = resolve_mudir_db_path(app)?;
  if !src_db.exists() {
    return Err("Database file does not exist yet.".into());
  }

  if let Some(parent) = dest_path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }

  let temp_db = std::env::temp_dir().join(format!(
    "mudir-backup-{}.db",
    Local::now().timestamp_millis()
  ));
  sqlite_backup_to(&src_db, &temp_db)?;

  let manifest = BackupManifest {
    format: 1,
    app_version: env!("CARGO_PKG_VERSION").into(),
    schema_version: read_schema_version(&temp_db)?,
    created_at: Local::now().to_rfc3339(),
    company_name: company_name.to_string(),
    trigger: trigger.to_string(),
  };

  let file = File::create(dest_path).map_err(|e| e.to_string())?;
  let mut writer = ZipWriter::new(file);
  let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

  writer
    .start_file("manifest.json", options)
    .map_err(|e| e.to_string())?;
  let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
  writer
    .write_all(manifest_json.as_bytes())
    .map_err(|e| e.to_string())?;

  writer
    .start_file("mudir.db", options)
    .map_err(|e| e.to_string())?;
  let mut db_file = File::open(&temp_db).map_err(|e| e.to_string())?;
  let mut db_buffer = Vec::new();
  db_file
    .read_to_end(&mut db_buffer)
    .map_err(|e| e.to_string())?;
  writer
    .write_all(&db_buffer)
    .map_err(|e| e.to_string())?;

  add_dir_to_zip(&mut writer, &company_dir(app)?, "company", options)?;

  let license_path = app_data_path(app, "license.json")?;
  if license_path.exists() {
    writer
      .start_file("license.json", options)
      .map_err(|e| e.to_string())?;
    let mut license_file = File::open(&license_path).map_err(|e| e.to_string())?;
    let mut license_buffer = Vec::new();
    license_file
      .read_to_end(&mut license_buffer)
      .map_err(|e| e.to_string())?;
    writer
      .write_all(&license_buffer)
      .map_err(|e| e.to_string())?;
  }

  writer.finish().map_err(|e| e.to_string())?;
  let _ = std::fs::remove_file(temp_db);

  save_last_backup(app, dest_path, &manifest.created_at)?;
  crate::google_drive::maybe_upload_latest_backup(app, dest_path);
  Ok(())
}

fn extract_zip_entry(
  archive: &mut ZipArchive<File>,
  name: &str,
  dest: &Path,
) -> Result<(), String> {
  let mut file = archive
    .by_name(name)
    .map_err(|_| format!("missing {name}"))?;
  if file.is_dir() {
    return Ok(());
  }
  if let Some(parent) = dest.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let mut out = File::create(dest).map_err(|e| e.to_string())?;
  std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
  Ok(())
}

pub fn restore_mudir_backup_bundle(app: &tauri::AppHandle, src_path: &Path) -> Result<(), String> {
  if !src_path.exists() {
    return Err("Backup file not found.".into());
  }

  let temp_dir = std::env::temp_dir().join(format!(
    "mudir-restore-{}",
    Local::now().timestamp_millis()
  ));
  std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

  let file = File::open(src_path).map_err(|e| e.to_string())?;
  let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

  let mut manifest_raw = String::new();
  {
    let mut manifest_file = archive
      .by_name("manifest.json")
      .map_err(|_| "Invalid backup: missing manifest.json".to_string())?;
    manifest_file
      .read_to_string(&mut manifest_raw)
      .map_err(|e| e.to_string())?;
  }

  let manifest: BackupManifest =
    serde_json::from_str(&manifest_raw).map_err(|e| format!("invalid manifest: {e}"))?;

  if manifest.schema_version > EXPECTED_SCHEMA_VERSION {
    return Err(format!(
      "Backup schema version {} is newer than this app (v{EXPECTED_SCHEMA_VERSION}). Update Mudir first.",
      manifest.schema_version
    ));
  }

  let file = File::open(src_path).map_err(|e| e.to_string())?;
  let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

  let temp_db = temp_dir.join("mudir.db");
  extract_zip_entry(&mut archive, "mudir.db", &temp_db)?;

  let dest_db = resolve_mudir_db_path(app)?;
  if dest_db.exists() {
    let epoch_ms = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_or(0, |duration| duration.as_millis());
    let pre_restore = dest_db.with_extension(format!("pre-restore-{epoch_ms}.db"));
    sqlite_backup_to(&dest_db, &pre_restore)?;
  }
  sqlite_backup_to(&temp_db, &dest_db)?;

  let file = File::open(src_path).map_err(|e| e.to_string())?;
  let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

  let company_dest = company_dir(app)?;
  std::fs::create_dir_all(&company_dest).map_err(|e| e.to_string())?;
  for i in 0..archive.len() {
    let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
    let name = entry.name().to_string();
    if let Some(rest) = name.strip_prefix("company/") {
      if rest.is_empty() || entry.is_dir() {
        continue;
      }
      let out = company_dest.join(rest);
      if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
      }
      let mut out_file = File::create(&out).map_err(|e| e.to_string())?;
      std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
    }
  }

  if archive.by_name("license.json").is_ok() {
    let file = File::open(src_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    let license_dest = app_data_path(app, "license.json")?;
    extract_zip_entry(&mut archive, "license.json", &license_dest)?;
  }

  let _ = std::fs::remove_dir_all(temp_dir);
  Ok(())
}

fn prune_old_backups(dir: &Path, keep_days: i64) -> Result<(), String> {
  if !dir.exists() {
    return Ok(());
  }
  let cutoff = Local::now().date_naive() - chrono::Duration::days(keep_days);
  for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
      continue;
    };
    if !name.ends_with(BACKUP_EXT) {
      continue;
    }
    let Some(date_str) = name
      .strip_prefix("mudir-backup-")
      .and_then(|s| s.strip_suffix(&format!(".{BACKUP_EXT}")))
    else {
      continue;
    };
    let Ok(file_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") else {
      continue;
    };
    if file_date < cutoff {
      let _ = std::fs::remove_file(path);
    }
  }
  Ok(())
}

pub fn run_daily_backup_if_needed(
  app: &tauri::AppHandle,
  company_name: &str,
) -> Result<Option<String>, String> {
  let prefs = load_preferences(app);
  if !prefs.auto_daily {
    return Ok(None);
  }

  let dir = backup_dir(app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

  let dest = dir.join(today_backup_name());
  if dest.exists() {
    return Ok(None);
  }

  create_mudir_backup_bundle(app, &dest, "daily_auto", company_name)?;
  prune_old_backups(&dir, KEEP_DAYS)?;
  Ok(Some(dest.to_string_lossy().into_owned()))
}

pub fn get_backup_status(app: &tauri::AppHandle) -> Result<BackupStatus, String> {
  let dir = backup_dir(app)?;
  let today_path = dir.join(today_backup_name());
  let prefs = load_preferences(app);
  let last = load_last_backup(app);

  Ok(BackupStatus {
    dir: dir.to_string_lossy().into_owned(),
    last_backup_at: last.as_ref().map(|m| m.created_at.clone()),
    last_backup_path: last.map(|m| m.path),
    today_exists: today_path.exists(),
    auto_enabled: prefs.auto_daily,
  })
}

pub fn set_auto_daily_backup(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
  let mut prefs = load_preferences(app);
  prefs.auto_daily = enabled;
  save_preferences(app, &prefs)
}

pub fn open_backup_folder(app: &tauri::AppHandle) -> Result<(), String> {
  let dir = backup_dir(app)?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  tauri_plugin_opener::open_path(dir.to_string_lossy().as_ref(), None::<&str>)
    .map_err(|e| e.to_string())
}
