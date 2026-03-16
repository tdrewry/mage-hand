#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  use tauri_plugin_shell::ShellExt;
  use tauri_plugin_shell::process::CommandEvent;
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Spawn the Jazz Sync Node Sidecar
      let sidecar_command = app.shell().sidecar("jazz-sync-server")
        .expect("Failed to create `jazz-sync-server` sidecar wrapper");
      
      let (mut rx, mut _child) = sidecar_command
        .spawn()
        .expect("Failed to spawn Jazz sidecar");
        
      tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
          if let CommandEvent::Stdout(line) = event {
            let line_str = String::from_utf8_lossy(&line);
            log::info!("[Jazz Sidecar] {}", line_str);
          } else if let CommandEvent::Stderr(line) = event {
            let line_str = String::from_utf8_lossy(&line);
            log::error!("[Jazz Sidecar] {}", line_str);
          }
        }
      });
      
      Ok(())
    })
    .plugin(tauri_plugin_shell::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
