// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  if let Err(err) = tauri_nextjs_template_lib::run() {
    eprintln!("error while running tauri application: {err}");
    std::process::exit(1);
  }
}
