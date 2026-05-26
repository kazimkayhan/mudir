use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

const REDIRECT_PORT: u16 = 8765;
const REDIRECT_URI: &str = "http://127.0.0.1:8765/callback";
const DRIVE_SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const MUDIR_FOLDER: &str = "Mudir Backups";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleDriveAuth {
  access_token: String,
  auto_upload: bool,
  client_id: String,
  expires_at: i64,
  refresh_token: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleDriveStatus {
  pub auto_upload: bool,
  pub client_id: Option<String>,
  pub connected: bool,
}

fn auth_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .resolve("google-drive-auth.json", tauri::path::BaseDirectory::AppData)
    .map_err(|e| format!("resolve google drive auth: {e}"))
}

fn load_auth(app: &tauri::AppHandle) -> Option<GoogleDriveAuth> {
  let path = auth_path(app).ok()?;
  let raw = fs::read_to_string(path).ok()?;
  serde_json::from_str(&raw).ok()
}

fn save_auth(app: &tauri::AppHandle, auth: &GoogleDriveAuth) -> Result<(), String> {
  let path = auth_path(app)?;
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let json = serde_json::to_string_pretty(auth).map_err(|e| e.to_string())?;
  fs::write(path, json).map_err(|e| e.to_string())
}

fn pkce_pair() -> (String, String) {
  let mut bytes = [0_u8; 32];
  rand::thread_rng().fill_bytes(&mut bytes);
  let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
  let digest = Sha256::digest(verifier.as_bytes());
  let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest);
  (verifier, challenge)
}

fn wait_for_auth_code(timeout: Duration) -> Result<String, String> {
  let listener = TcpListener::bind(format!("127.0.0.1:{REDIRECT_PORT}"))
    .map_err(|e| format!("bind oauth callback port: {e}"))?;
  listener
    .set_nonblocking(true)
    .map_err(|e| format!("set nonblocking: {e}"))?;
  let started = Instant::now();
  loop {
    if started.elapsed() > timeout {
      return Err("Google sign-in timed out".into());
    }
    if let Ok((mut stream, _)) = listener.accept() {
      let mut buffer = [0_u8; 4096];
      let read = stream.read(&mut buffer).map_err(|e| e.to_string())?;
      let request = String::from_utf8_lossy(&buffer[..read]);
      let code = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|path| path.split('?').nth(1))
        .and_then(|query| {
          query.split('&').find_map(|pair| {
            pair.strip_prefix("code=").map(|value| {
              urlencoding::decode(value)
                .map(|decoded| decoded.into_owned())
                .map_err(|e| e.to_string())
            })
          })
        })
        .transpose()
        .map_err(|e| e.to_string())?;
      let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
        <html><body><h1>Mudir connected to Google Drive</h1><p>You can close this tab.</p></body></html>";
      stream.write_all(response.as_bytes()).map_err(|e| e.to_string())?;
      if let Some(code) = code {
        return Ok(code);
      }
      return Err("Missing authorization code".into());
    }
    thread::sleep(Duration::from_millis(200));
  }
}

async fn exchange_code(
  client_id: &str,
  code: &str,
  code_verifier: &str,
) -> Result<GoogleDriveAuth, String> {
  let client = reqwest::Client::new();
  let response = client
    .post("https://oauth2.googleapis.com/token")
    .form(&[
      ("client_id", client_id),
      ("code", code),
      ("code_verifier", code_verifier),
      ("redirect_uri", REDIRECT_URI),
      ("grant_type", "authorization_code"),
    ])
    .send()
    .await
    .map_err(|e| format!("token request: {e}"))?;
  let body: serde_json::Value = response
    .json()
    .await
    .map_err(|e| format!("token response: {e}"))?;
  if let Some(error) = body.get("error").and_then(|v| v.as_str()) {
    return Err(format!("Google token error: {error}"));
  }
  let access_token = body
    .get("access_token")
    .and_then(|v| v.as_str())
    .ok_or("Missing access token")?
    .to_string();
  let refresh_token = body
    .get("refresh_token")
    .and_then(|v| v.as_str())
    .ok_or("Missing refresh token")?
    .to_string();
  let expires_in = body
    .get("expires_in")
    .and_then(|v| v.as_i64())
    .unwrap_or(3600);
  let expires_at = chrono::Utc::now().timestamp() + expires_in;
  Ok(GoogleDriveAuth {
    access_token,
    auto_upload: false,
    client_id: client_id.to_string(),
    expires_at,
    refresh_token,
  })
}

async fn refresh_access_token(auth: &mut GoogleDriveAuth) -> Result<(), String> {
  if auth.expires_at > chrono::Utc::now().timestamp() + 60 {
    return Ok(());
  }
  let client = reqwest::Client::new();
  let response = client
    .post("https://oauth2.googleapis.com/token")
    .form(&[
      ("client_id", auth.client_id.as_str()),
      ("refresh_token", auth.refresh_token.as_str()),
      ("grant_type", "refresh_token"),
    ])
    .send()
    .await
    .map_err(|e| format!("refresh request: {e}"))?;
  let body: serde_json::Value = response
    .json()
    .await
    .map_err(|e| format!("refresh response: {e}"))?;
  let access_token = body
    .get("access_token")
    .and_then(|v| v.as_str())
    .ok_or("Missing refreshed access token")?;
  auth.access_token = access_token.to_string();
  auth.expires_at = chrono::Utc::now().timestamp()
    + body.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(3600);
  Ok(())
}

async fn ensure_drive_folder(auth: &mut GoogleDriveAuth) -> Result<String, String> {
  refresh_access_token(auth).await?;
  let client = reqwest::Client::new();
  let query = format!(
    "mimeType='application/vnd.google-apps.folder' and name='{MUDIR_FOLDER}' and trashed=false"
  );
  let search = client
    .get("https://www.googleapis.com/drive/v3/files")
    .bearer_auth(&auth.access_token)
    .query(&[
      ("q", query.as_str()),
      ("fields", "files(id,name)"),
      ("spaces", "drive"),
    ])
    .send()
    .await
    .map_err(|e| format!("drive search: {e}"))?;
  let body: serde_json::Value = search.json().await.map_err(|e| e.to_string())?;
  if let Some(id) = body
    .get("files")
    .and_then(|v| v.as_array())
    .and_then(|files| files.first())
    .and_then(|file| file.get("id"))
    .and_then(|v| v.as_str())
  {
    return Ok(id.to_string());
  }

  let create = client
    .post("https://www.googleapis.com/drive/v3/files")
    .bearer_auth(&auth.access_token)
    .json(&serde_json::json!({
      "name": MUDIR_FOLDER,
      "mimeType": "application/vnd.google-apps.folder"
    }))
    .send()
    .await
    .map_err(|e| format!("create folder: {e}"))?;
  let created: serde_json::Value = create.json().await.map_err(|e| e.to_string())?;
  created
    .get("id")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .ok_or_else(|| "Missing folder id".to_string())
}

async fn upload_file(auth: &mut GoogleDriveAuth, file_path: &Path) -> Result<(), String> {
  let folder_id = ensure_drive_folder(auth).await?;
  refresh_access_token(auth).await?;
  let bytes = fs::read(file_path).map_err(|e| format!("read backup: {e}"))?;
  let file_name = file_path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("mudir-backup.mudir-backup");
  let metadata = serde_json::json!({
    "name": file_name,
    "parents": [folder_id]
  });
  let part = reqwest::multipart::Part::text(metadata.to_string())
    .mime_str("application/json")
    .map_err(|e| e.to_string())?;
  let file_part = reqwest::multipart::Part::bytes(bytes)
    .mime_str("application/zip")
    .map_err(|e| e.to_string())?
    .file_name(file_name.to_string());
  let form = reqwest::multipart::Form::new()
    .part("metadata", part)
    .part("file", file_part);
  let client = reqwest::Client::new();
  let response = client
    .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
    .bearer_auth(&auth.access_token)
    .multipart(form)
    .send()
    .await
    .map_err(|e| format!("drive upload: {e}"))?;
  if !response.status().is_success() {
    let text = response.text().await.unwrap_or_default();
    return Err(format!("Drive upload failed: {text}"));
  }
  Ok(())
}

#[tauri::command]
pub fn get_google_drive_status(app: tauri::AppHandle) -> GoogleDriveStatus {
  match load_auth(&app) {
    Some(auth) => GoogleDriveStatus {
      auto_upload: auth.auto_upload,
      client_id: Some(auth.client_id),
      connected: true,
    },
    None => GoogleDriveStatus {
      auto_upload: false,
      client_id: None,
      connected: false,
    },
  }
}

#[tauri::command]
pub fn disconnect_google_drive(app: tauri::AppHandle) -> Result<(), String> {
  if let Ok(path) = auth_path(&app) {
    let _ = fs::remove_file(path);
  }
  Ok(())
}

#[tauri::command]
pub fn set_google_drive_auto_upload(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
  let mut auth = load_auth(&app).ok_or("Google Drive is not connected")?;
  auth.auto_upload = enabled;
  save_auth(&app, &auth)
}

#[tauri::command]
pub fn connect_google_drive(app: tauri::AppHandle, client_id: String) -> Result<(), String> {
  let trimmed = client_id.trim();
  if trimmed.is_empty() {
    return Err("Google client ID is required".into());
  }
  let (verifier, challenge) = pkce_pair();
  let auth_url = format!(
    "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent",
    urlencoding::encode(trimmed),
    urlencoding::encode(REDIRECT_URI),
    urlencoding::encode(DRIVE_SCOPE),
    urlencoding::encode(&challenge)
  );
  app
    .opener()
    .open_url(auth_url, None::<&str>)
    .map_err(|e| format!("open browser: {e}"))?;
  let code = wait_for_auth_code(Duration::from_secs(180))?;
  let runtime = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
  let auth = runtime.block_on(exchange_code(trimmed, &code, &verifier))?;
  save_auth(&app, &auth)
}

#[tauri::command]
pub fn upload_backup_to_google_drive(app: tauri::AppHandle, file_path: String) -> Result<(), String> {
  let mut auth = load_auth(&app).ok_or("Google Drive is not connected")?;
  let path = PathBuf::from(file_path);
  let runtime = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
  runtime.block_on(upload_file(&mut auth, &path))?;
  save_auth(&app, &auth)
}

pub fn maybe_upload_latest_backup(app: &tauri::AppHandle, backup_path: &Path) {
  let Some(mut auth) = load_auth(app) else {
    return;
  };
  if !auth.auto_upload {
    return;
  }
  if let Ok(runtime) = tokio::runtime::Runtime::new() {
    let path = backup_path.to_path_buf();
    let app_handle = app.clone();
    let _ = runtime.block_on(async {
      if upload_file(&mut auth, &path).await.is_ok() {
        let _ = save_auth(&app_handle, &auth);
      }
    });
  }
}
