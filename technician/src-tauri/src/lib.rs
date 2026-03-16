use base64::Engine;
use serde::Serialize;
use std::fs;
use tauri::Manager;

#[derive(Serialize)]
struct FileData {
    name: String,
    size: u64,
    data: String, // base64 encoded
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<FileData, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let name = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    Ok(FileData {
        name,
        size: metadata.len(),
        data: encoded,
    })
}

#[tauri::command]
fn create_toolbar(app: tauri::AppHandle) -> Result<(), String> {
    // Check if toolbar already exists
    if app.get_webview_window("toolbar").is_some() {
        return Ok(());
    }

    let monitor = app.primary_monitor().map_err(|e| e.to_string())?;
    let screen_width = monitor
        .map(|m| m.size().width)
        .unwrap_or(1920);

    let toolbar_width = 500.0;
    let x = ((screen_width as f64 - toolbar_width) / 2.0) as i32;

    tauri::WebviewWindowBuilder::new(&app, "toolbar", tauri::WebviewUrl::App("toolbar.html".into()))
        .title("Remote Control Active")
        .inner_size(toolbar_width, 50.0)
        .position(x as f64, 0.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .transparent(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn destroy_toolbar(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("toolbar") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            read_file_base64,
            create_toolbar,
            destroy_toolbar,
        ])
        .setup(|app| {
            // Set up system tray
            let _tray = tauri::tray::TrayIconBuilder::new()
                .tooltip("Numbers10 Support Admin")
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
