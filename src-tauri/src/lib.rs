//! Optional Tauri 2 desktop shell for DnB Studio.
//! Browser Sketch remains primary on the box. No ACE/GPU in this crate.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
