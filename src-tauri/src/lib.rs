use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Serialize, Deserialize)]
struct Article {
    title: String,
    description: String,
    link: String,
    thumbnail_url: String,
}

// RSS取得コマンド
#[tauri::command]
async fn fetch_rss(feed_url: String) -> Result<Vec<Article>, String> {
    println!("Fetching RSS from: {}", feed_url);

    match fetch_rss_internal(&feed_url).await {
        Ok(articles) => {
            println!("Successfully fetched {} articles", articles.len());
            Ok(articles)
        }
        Err(e) => {
            println!("Error fetching RSS: {}", e);
            Err(format!("Failed to fetch RSS: {}", e))
        }
    }
}

async fn fetch_rss_internal(feed_url: &str) -> Result<Vec<Article>, Box<dyn Error>> {
    // HTTPリクエストでRSSを取得
    let response = reqwest::get(feed_url).await?;
    let content = response.bytes().await?;

    // RSSをパース
    let feed = feed_rs::parser::parse(&content[..])?;

    // 記事を変換
    let articles: Vec<Article> = feed
        .entries
        .iter()
        .take(30)
        .map(|entry| {
            let title = entry.title.as_ref()
                .map(|t| t.content.clone())
                .unwrap_or_else(|| "No title".to_string());

            let description = entry.summary.as_ref()
                .map(|s| s.content.clone())
                .or_else(|| entry.content.as_ref().and_then(|c| c.body.clone()))
                .unwrap_or_else(|| "".to_string());

            let link = entry.links.first()
                .map(|l| l.href.clone())
                .unwrap_or_else(|| "".to_string());

            let thumbnail_url = entry.media.iter()
                .flat_map(|m| &m.thumbnails)
                .next()
                .map(|t| t.image.uri.clone())
                .unwrap_or_else(|| "".to_string());

            Article {
                title,
                description,
                link,
                thumbnail_url,
            }
        })
        .collect();

    Ok(articles)
}

// URLを開くコマンド
#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    println!("Opening URL: {}", url);
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

// マスコット画像選択コマンド
#[tauri::command]
async fn select_mascot_image(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let file = app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp"])
        .blocking_pick_file();

    match file {
        Some(file_path) => {
            let path_str = file_path.to_string();
            println!("Selected mascot image: {}", path_str);
            Ok(path_str)
        }
        None => Err("No file selected".to_string())
    }
}

// ウィンドウ位置を取得
#[tauri::command]
async fn get_window_position(window: tauri::Window) -> Result<(i32, i32), String> {
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    Ok((position.x, position.y))
}

// ウィンドウ位置を設定
#[tauri::command]
async fn set_window_position(window: tauri::Window, x: i32, y: i32) -> Result<(), String> {
    use tauri::Position;
    window.set_position(Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| format!("Failed to set window position: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fetch_rss,
            open_url,
            select_mascot_image,
            get_window_position,
            set_window_position
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
