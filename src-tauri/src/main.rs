// Punto de entrada de la app de escritorio.
// No necesitas tocar este archivo: registra los "plugins" que le permiten a FreePOS
// guardar su archivo de datos, mostrar los diálogos nativos de "Guardar como" /
// "Abrir archivo" (copias de seguridad), abrir enlaces externos en el navegador, y
// buscar/descargar/instalar actualizaciones automáticamente (con reinicio).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error al iniciar FreePOS");
}
