use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

// ── Win32 Input Injection ──

#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, mouse_event, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
    KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, MOUSEEVENTF_HWHEEL,
    MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
    MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL,
    VIRTUAL_KEY, KEYBD_EVENT_FLAGS,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SetCursorPos, SM_CXSCREEN, SM_CYSCREEN};

/// Map web KeyboardEvent.code to Windows virtual key code
fn key_code_to_vk(code: &str) -> Option<u8> {
    match code {
        "KeyA" => Some(0x41), "KeyB" => Some(0x42), "KeyC" => Some(0x43),
        "KeyD" => Some(0x44), "KeyE" => Some(0x45), "KeyF" => Some(0x46),
        "KeyG" => Some(0x47), "KeyH" => Some(0x48), "KeyI" => Some(0x49),
        "KeyJ" => Some(0x4A), "KeyK" => Some(0x4B), "KeyL" => Some(0x4C),
        "KeyM" => Some(0x4D), "KeyN" => Some(0x4E), "KeyO" => Some(0x4F),
        "KeyP" => Some(0x50), "KeyQ" => Some(0x51), "KeyR" => Some(0x52),
        "KeyS" => Some(0x53), "KeyT" => Some(0x54), "KeyU" => Some(0x55),
        "KeyV" => Some(0x56), "KeyW" => Some(0x57), "KeyX" => Some(0x58),
        "KeyY" => Some(0x59), "KeyZ" => Some(0x5A),
        "Digit0" => Some(0x30), "Digit1" => Some(0x31), "Digit2" => Some(0x32),
        "Digit3" => Some(0x33), "Digit4" => Some(0x34), "Digit5" => Some(0x35),
        "Digit6" => Some(0x36), "Digit7" => Some(0x37), "Digit8" => Some(0x38),
        "Digit9" => Some(0x39),
        "Numpad0" => Some(0x60), "Numpad1" => Some(0x61), "Numpad2" => Some(0x62),
        "Numpad3" => Some(0x63), "Numpad4" => Some(0x64), "Numpad5" => Some(0x65),
        "Numpad6" => Some(0x66), "Numpad7" => Some(0x67), "Numpad8" => Some(0x68),
        "Numpad9" => Some(0x69),
        "NumpadMultiply" => Some(0x6A), "NumpadAdd" => Some(0x6B),
        "NumpadSubtract" => Some(0x6D), "NumpadDecimal" => Some(0x6E),
        "NumpadDivide" => Some(0x6F),
        "F1" => Some(0x70), "F2" => Some(0x71), "F3" => Some(0x72),
        "F4" => Some(0x73), "F5" => Some(0x74), "F6" => Some(0x75),
        "F7" => Some(0x76), "F8" => Some(0x77), "F9" => Some(0x78),
        "F10" => Some(0x79), "F11" => Some(0x7A), "F12" => Some(0x7B),
        "Backspace" => Some(0x08), "Tab" => Some(0x09),
        "Enter" | "NumpadEnter" => Some(0x0D),
        "ShiftLeft" | "ShiftRight" => Some(0x10),
        "ControlLeft" | "ControlRight" => Some(0x11),
        "AltLeft" | "AltRight" => Some(0x12),
        "MetaLeft" => Some(0x5B), "MetaRight" => Some(0x5C),
        "Pause" => Some(0x13), "CapsLock" => Some(0x14), "Escape" => Some(0x1B),
        "Space" => Some(0x20), "PageUp" => Some(0x21), "PageDown" => Some(0x22),
        "End" => Some(0x23), "Home" => Some(0x24),
        "ArrowLeft" => Some(0x25), "ArrowUp" => Some(0x26),
        "ArrowRight" => Some(0x27), "ArrowDown" => Some(0x28),
        "PrintScreen" => Some(0x2C), "Insert" => Some(0x2D), "Delete" => Some(0x2E),
        "ScrollLock" => Some(0x91), "NumLock" => Some(0x90),
        "Semicolon" => Some(0xBA), "Equal" => Some(0xBB), "Comma" => Some(0xBC),
        "Minus" => Some(0xBD), "Period" => Some(0xBE), "Slash" => Some(0xBF),
        "Backquote" => Some(0xC0), "BracketLeft" => Some(0xDB),
        "Backslash" => Some(0xDC), "BracketRight" => Some(0xDD),
        "Quote" => Some(0xDE), "ContextMenu" => Some(0x5D),
        _ => None,
    }
}

fn is_extended_key(code: &str) -> bool {
    matches!(
        code,
        "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"
            | "Insert" | "Delete" | "Home" | "End" | "PageUp" | "PageDown"
            | "NumpadEnter" | "ControlRight" | "AltRight"
            | "MetaLeft" | "MetaRight" | "PrintScreen" | "ContextMenu"
    )
}

#[tauri::command]
fn get_screen_size() -> (i32, i32) {
    #[cfg(target_os = "windows")]
    unsafe {
        let w = GetSystemMetrics(SM_CXSCREEN);
        let h = GetSystemMetrics(SM_CYSCREEN);
        (w, h)
    }
    #[cfg(not(target_os = "windows"))]
    (1920, 1080)
}

#[derive(Deserialize)]
struct InputEvent {
    #[serde(rename = "type")]
    event_type: String,
    x: Option<f64>,
    y: Option<f64>,
    button: Option<i32>,
    #[serde(rename = "deltaX")]
    delta_x: Option<f64>,
    #[serde(rename = "deltaY")]
    delta_y: Option<f64>,
    #[serde(rename = "keyCode")]
    key_code: Option<String>,
}

#[tauri::command]
fn handle_input_event(event: InputEvent, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if !*state.control_active.lock().unwrap() {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    unsafe {
        let (screen_w, screen_h) = get_screen_size();

        match event.event_type.as_str() {
            "mouse-move" => {
                if let (Some(x), Some(y)) = (event.x, event.y) {
                    let px = (x * screen_w as f64) as i32;
                    let py = (y * screen_h as f64) as i32;
                    let _ = SetCursorPos(px, py);
                }
            }
            "mouse-down" => {
                if let (Some(x), Some(y)) = (event.x, event.y) {
                    let px = (x * screen_w as f64) as i32;
                    let py = (y * screen_h as f64) as i32;
                    let _ = SetCursorPos(px, py);
                    let flags = match event.button.unwrap_or(0) {
                        0 => MOUSEEVENTF_LEFTDOWN,
                        1 => MOUSEEVENTF_MIDDLEDOWN,
                        2 => MOUSEEVENTF_RIGHTDOWN,
                        _ => return Ok(()),
                    };
                    mouse_event(flags, 0, 0, 0, 0);
                }
            }
            "mouse-up" => {
                if let (Some(x), Some(y)) = (event.x, event.y) {
                    let px = (x * screen_w as f64) as i32;
                    let py = (y * screen_h as f64) as i32;
                    let _ = SetCursorPos(px, py);
                    let flags = match event.button.unwrap_or(0) {
                        0 => MOUSEEVENTF_LEFTUP,
                        1 => MOUSEEVENTF_MIDDLEUP,
                        2 => MOUSEEVENTF_RIGHTUP,
                        _ => return Ok(()),
                    };
                    mouse_event(flags, 0, 0, 0, 0);
                }
            }
            "mouse-scroll" => {
                let dy = event.delta_y.unwrap_or(0.0) as i32;
                let dx = event.delta_x.unwrap_or(0.0) as i32;
                if dy != 0 {
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -dy * 120, 0);
                }
                if dx != 0 {
                    mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, dx * 120, 0);
                }
            }
            "key-down" => {
                if let Some(ref code) = event.key_code {
                    if let Some(vk) = key_code_to_vk(code) {
                        let mut flags = windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0);
                        if is_extended_key(code) {
                            flags |= KEYEVENTF_EXTENDEDKEY;
                        }
                        keybd_event(vk, 0, flags, 0);
                    }
                }
            }
            "key-up" => {
                if let Some(ref code) = event.key_code {
                    if let Some(vk) = key_code_to_vk(code) {
                        let mut flags = KEYEVENTF_KEYUP;
                        if is_extended_key(code) {
                            flags |= KEYEVENTF_EXTENDEDKEY;
                        }
                        keybd_event(vk, 0, flags, 0);
                    }
                }
            }
            _ => {}
        }
    }

    Ok(())
}

// ── Secure Attention Sequence (Ctrl+Alt+Del) ──
// True Ctrl+Alt+Del cannot be simulated in user mode on modern Windows.
// We send Ctrl+Shift+Esc (opens Task Manager) as the best alternative.

#[tauri::command]
fn send_sas() {
    #[cfg(target_os = "windows")]
    unsafe {
        // Use SendInput (modern API) to send Ctrl+Shift+Esc → opens Task Manager
        let make_key = |vk: u16, flags: KEYBD_EVENT_FLAGS| -> INPUT {
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY(vk),
                        wScan: 0,
                        dwFlags: flags,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            }
        };

        let inputs = [
            make_key(0x11, KEYBD_EVENT_FLAGS(0)),    // Ctrl down
            make_key(0x10, KEYBD_EVENT_FLAGS(0)),    // Shift down
            make_key(0x1B, KEYBD_EVENT_FLAGS(0)),    // Esc down
            make_key(0x1B, KEYEVENTF_KEYUP),         // Esc up
            make_key(0x10, KEYEVENTF_KEYUP),         // Shift up
            make_key(0x11, KEYEVENTF_KEYUP),         // Ctrl up
        ];

        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
}

// ── Native Screen Capture (Win32 GDI BitBlt) ──
// Captures the entire primary screen without any browser picker.
// Called per-frame from JS via invoke('capture_frame').

#[cfg(target_os = "windows")]
fn capture_screen_gdi() -> Result<Vec<u8>, String> {
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDC, GetDeviceCaps, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO,
        BITMAPINFOHEADER, DESKTOPHORZRES, DESKTOPVERTRES, DIB_RGB_COLORS, SRCCOPY,
    };
    use windows::Win32::Foundation::HWND;

    unsafe {
        let hdc_screen = GetDC(HWND::default());
        if hdc_screen.is_invalid() {
            return Err("GetDC failed".into());
        }

        // Physical pixel dimensions — not DPI-scaled
        let w = GetDeviceCaps(hdc_screen, DESKTOPHORZRES);
        let h = GetDeviceCaps(hdc_screen, DESKTOPVERTRES);
        if w <= 0 || h <= 0 {
            ReleaseDC(HWND::default(), hdc_screen);
            return Err(format!("Invalid screen size: {}x{}", w, h));
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            ReleaseDC(HWND::default(), hdc_screen);
            return Err("CreateCompatibleDC failed".into());
        }

        let hbm = CreateCompatibleBitmap(hdc_screen, w, h);
        if hbm.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(HWND::default(), hdc_screen);
            return Err("CreateCompatibleBitmap failed".into());
        }

        let old_obj = SelectObject(hdc_mem, hbm);
        let _ = BitBlt(hdc_mem, 0, 0, w, h, hdc_screen, 0, 0, SRCCOPY);

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h, // negative = top-down row order
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0, // BI_RGB
                ..Default::default()
            },
            ..Default::default()
        };

        let buf_size = (w * h * 4) as usize;
        let mut bgra = vec![0u8; buf_size];
        let lines = GetDIBits(
            hdc_mem,
            hbm,
            0,
            h as u32,
            Some(bgra.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbm);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(HWND::default(), hdc_screen);

        if lines == 0 {
            return Err("GetDIBits returned 0 lines".into());
        }

        // Convert BGRA → RGB
        let pixel_count = (w * h) as usize;
        let mut rgb = Vec::with_capacity(pixel_count * 3);
        for pixel in bgra.chunks_exact(4) {
            rgb.push(pixel[2]); // R
            rgb.push(pixel[1]); // G
            rgb.push(pixel[0]); // B
        }

        // Encode JPEG
        use image::codecs::jpeg::JpegEncoder;
        let img = image::RgbImage::from_raw(w as u32, h as u32, rgb)
            .ok_or("RgbImage::from_raw failed")?;
        let mut jpeg_buf = Vec::new();
        let encoder = JpegEncoder::new_with_quality(&mut jpeg_buf, 80);
        img.write_with_encoder(encoder).map_err(|e| format!("JPEG encode: {}", e))?;

        Ok(jpeg_buf)
    }
}

/// Called from JS per-frame to get a screen capture as base64 JPEG
#[tauri::command]
fn capture_frame() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let jpeg = capture_screen_gdi()?;
        Ok(base64::engine::general_purpose::STANDARD.encode(&jpeg))
    }
    #[cfg(not(target_os = "windows"))]
    Err("Screen capture not supported on this platform".into())
}

// ── Control State ──

#[tauri::command]
fn control_granted(state: tauri::State<'_, AppState>) {
    *state.control_active.lock().unwrap() = true;
}

#[tauri::command]
fn control_denied(state: tauri::State<'_, AppState>) {
    *state.control_active.lock().unwrap() = false;
}

#[tauri::command]
fn control_revoke(state: tauri::State<'_, AppState>) {
    *state.control_active.lock().unwrap() = false;
}

#[tauri::command]
fn session_ended(state: tauri::State<'_, AppState>) {
    *state.control_active.lock().unwrap() = false;
}


// ── File Transfer (receive from technician) ──

struct PendingFile {
    file: std::fs::File,
    path: String,
    received: u64,
    size: u64,
}

#[derive(Deserialize)]
struct FileStartData {
    #[serde(rename = "fileId")]
    file_id: String,
    filename: String,
    size: u64,
}

#[derive(Deserialize)]
struct FileChunkData {
    #[serde(rename = "fileId")]
    file_id: String,
    chunk: String, // base64
}

#[derive(Deserialize)]
struct FileEndData {
    #[serde(rename = "fileId")]
    file_id: String,
}

#[derive(Serialize, Clone)]
struct FileReceivedEvent {
    filename: String,
    path: String,
}

#[tauri::command]
fn file_start(data: FileStartData, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let downloads = dirs::download_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let safe_name: String = data
        .filename
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    let file_path = downloads.join(&safe_name);
    let file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    let pending = PendingFile {
        file,
        path: file_path.to_string_lossy().to_string(),
        received: 0,
        size: data.size,
    };
    state
        .pending_files
        .lock()
        .unwrap()
        .insert(data.file_id, pending);
    Ok(())
}

#[tauri::command]
fn file_chunk(data: FileChunkData, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut files = state.pending_files.lock().unwrap();
    if let Some(pending) = files.get_mut(&data.file_id) {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&data.chunk)
            .map_err(|e| e.to_string())?;
        pending.file.write_all(&bytes).map_err(|e| e.to_string())?;
        pending.received += bytes.len() as u64;
    }
    Ok(())
}

#[tauri::command]
fn file_end(
    data: FileEndData,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let mut files = state.pending_files.lock().unwrap();
    if let Some(pending) = files.remove(&data.file_id) {
        drop(pending.file);
        let filename = std::path::Path::new(&pending.path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        // Emit event to frontend
        let _ = app.emit("file-received", FileReceivedEvent {
            filename,
            path: pending.path,
        });
    }
    Ok(())
}

// ── App State ──

struct AppState {
    control_active: Mutex<bool>,
    pending_files: Mutex<HashMap<String, PendingFile>>,
}

// ── App Entry ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            control_active: Mutex::new(false),
            pending_files: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_screen_size,
            handle_input_event,
            send_sas,
            capture_frame,
            control_granted,
            control_denied,
            control_revoke,
            session_ended,
            file_start,
            file_chunk,
            file_end,
        ])
        .setup(|app| {
            // Register Ctrl+Shift+F12 global shortcut to revoke control
            use tauri_plugin_global_shortcut::ShortcutState;
            app.global_shortcut().on_shortcut("Ctrl+Shift+F12", move |app: &tauri::AppHandle, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let state = app.state::<AppState>();
                    let was_active = {
                        let mut active = state.control_active.lock().unwrap();
                        let was = *active;
                        *active = false;
                        was
                    };
                    if was_active {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("control-revoked-local", "");
                        }
                    }
                }
            })?;

            // Set up system tray
            let _tray = tauri::tray::TrayIconBuilder::new()
                .tooltip("Numbers10 Support")
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
