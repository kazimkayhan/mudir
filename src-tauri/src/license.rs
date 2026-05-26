use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const PUBLIC_KEY_BYTES: [u8; 32] = [
  0x4e, 0xef, 0x01, 0x44, 0x61, 0x39, 0xd4, 0xce, 0x53, 0x2d, 0x52, 0xc4, 0x8f, 0xf1, 0x2e,
  0x1e, 0xc6, 0x5b, 0x49, 0x07, 0x9f, 0x56, 0x28, 0xfd, 0xc7, 0x8c, 0xca, 0xd1, 0x86, 0x61,
  0x03, 0x89,
];

const DEV_LICENSE_KEY: &str = "MUDIR-DEV-LOCAL-NOT-FOR-RESALE";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicensePayload {
  pub v: u8,
  pub customer_id: String,
  pub customer_email: String,
  pub issued_at: String,
  pub expires_at: String,
  pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredLicense {
  payload: LicensePayload,
  key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
  pub valid: bool,
  pub expired: bool,
  pub email: Option<String>,
  pub expires_at: Option<String>,
  pub days_remaining: Option<i64>,
  pub plan: Option<String>,
}

fn license_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .resolve("license.json", tauri::path::BaseDirectory::AppData)
    .map_err(|e| format!("resolve license path: {e}"))
}

fn dev_license_payload() -> LicensePayload {
  LicensePayload {
    v: 1,
    customer_id: "dev-local".into(),
    customer_email: "dev@local".into(),
    issued_at: "2026-01-01".into(),
    expires_at: "2099-12-31".into(),
    plan: "dev".into(),
  }
}

fn parse_expiry(expires_at: &str) -> Result<i64, String> {
  let date = expires_at
    .parse::<chrono::NaiveDate>()
    .map_err(|e| format!("invalid expiry date: {e}"))?;
  Ok(
    date
      .and_hms_opt(23, 59, 59)
      .ok_or("invalid expiry time")?
      .and_utc()
      .timestamp(),
  )
}

fn days_remaining(expires_at: &str) -> Result<i64, String> {
  let expiry_ts = parse_expiry(expires_at)?;
  let now = chrono::Utc::now().timestamp();
  Ok((expiry_ts - now).div_euclid(86_400))
}

fn is_payload_valid(payload: &LicensePayload) -> bool {
  parse_expiry(&payload.expires_at)
    .map(|expiry| chrono::Utc::now().timestamp() <= expiry)
    .unwrap_or(false)
}

fn decode_base64url(input: &str) -> Result<Vec<u8>, String> {
  use base64::Engine;
  base64::engine::general_purpose::URL_SAFE_NO_PAD
    .decode(input.as_bytes())
    .map_err(|e| format!("invalid base64: {e}"))
}

fn verify_license_key(key: &str) -> Result<LicensePayload, String> {
  let trimmed = key.trim();

  #[cfg(any(debug_assertions, feature = "dev-license"))]
  if trimmed == DEV_LICENSE_KEY {
    return Ok(dev_license_payload());
  }

  let parts: Vec<&str> = trimmed.split('.').collect();
  if parts.len() != 3 || parts[0] != "MUDIR1" {
    return Err("Invalid license key format.".into());
  }

  let payload_bytes = decode_base64url(parts[1])?;
  let signature_bytes = decode_base64url(parts[2])?;

  let verifying_key = VerifyingKey::from_bytes(&PUBLIC_KEY_BYTES)
    .map_err(|e| format!("invalid public key: {e}"))?;
  let signature = Signature::from_slice(&signature_bytes)
    .map_err(|e| format!("invalid signature: {e}"))?;

  verifying_key
    .verify(&payload_bytes, &signature)
    .map_err(|_| "License signature verification failed.".to_string())?;

  let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
    .map_err(|e| format!("invalid license payload: {e}"))?;

  if payload.v != 1 {
    return Err("Unsupported license version.".into());
  }

  Ok(payload)
}

fn load_stored_license(app: &tauri::AppHandle) -> Option<StoredLicense> {
  let path = license_file_path(app).ok()?;
  let raw = std::fs::read_to_string(path).ok()?;
  serde_json::from_str(&raw).ok()
}

fn save_stored_license(app: &tauri::AppHandle, stored: &StoredLicense) -> Result<(), String> {
  let path = license_file_path(app)?;
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| format!("create app data dir: {e}"))?;
  }
  let json = serde_json::to_string_pretty(stored).map_err(|e| e.to_string())?;
  std::fs::write(path, json).map_err(|e| format!("write license: {e}"))
}

pub fn license_status_from_payload(payload: &LicensePayload) -> LicenseStatus {
  let expired = !is_payload_valid(payload);
  let days = days_remaining(&payload.expires_at).unwrap_or(0);
  LicenseStatus {
    valid: !expired,
    expired,
    email: Some(payload.customer_email.clone()),
    expires_at: Some(payload.expires_at.clone()),
    days_remaining: Some(days),
    plan: Some(payload.plan.clone()),
  }
}

pub fn empty_license_status() -> LicenseStatus {
  LicenseStatus {
    valid: false,
    expired: false,
    email: None,
    expires_at: None,
    days_remaining: None,
    plan: None,
  }
}

pub fn get_license_status(app: &tauri::AppHandle) -> LicenseStatus {
  let Some(stored) = load_stored_license(app) else {
    return empty_license_status();
  };
  license_status_from_payload(&stored.payload)
}

pub fn activate_license(app: &tauri::AppHandle, key: String) -> Result<LicenseStatus, String> {
  let payload = verify_license_key(&key)?;
  let stored = StoredLicense {
    payload: payload.clone(),
    key: key.trim().to_string(),
  };
  save_stored_license(app, &stored)?;
  Ok(license_status_from_payload(&payload))
}

#[cfg(debug_assertions)]
pub fn clear_license(app: &tauri::AppHandle) -> Result<(), String> {
  let path = license_file_path(app)?;
  if path.exists() {
    std::fs::remove_file(path).map_err(|e| format!("remove license: {e}"))?;
  }
  Ok(())
}

#[cfg(not(debug_assertions))]
pub fn clear_license(_app: &tauri::AppHandle) -> Result<(), String> {
  Err("Not available in release builds.".into())
}
