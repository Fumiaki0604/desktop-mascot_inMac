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

// VOICEVOX音声合成
#[tauri::command]
async fn synthesize_speech(text: String, speaker_id: u32) -> Result<Vec<u8>, String> {
    // VOICEVOXはローカルAPIサーバーを使用する想定（http://localhost:50021）
    // または、VOICEVOX Web APIを使用する場合はAPI keyが必要

    println!("Synthesizing speech: {} (speaker: {})", text, speaker_id);

    // まずは音声クエリを生成
    let query_url = format!("http://localhost:50021/audio_query?text={}&speaker={}",
        urlencoding::encode(&text), speaker_id);

    let client = reqwest::Client::new();
    let query_response = client.post(&query_url)
        .send()
        .await
        .map_err(|e| format!("Failed to create audio query: {}. VOICEVOXが起動していない可能性があります。", e))?;

    if !query_response.status().is_success() {
        return Err(format!("Audio query failed with status: {}", query_response.status()));
    }

    let query_json = query_response.text().await
        .map_err(|e| format!("Failed to read query response: {}", e))?;

    // 音声合成を実行
    let synthesis_url = format!("http://localhost:50021/synthesis?speaker={}", speaker_id);
    let synthesis_response = client.post(&synthesis_url)
        .header("Content-Type", "application/json")
        .body(query_json)
        .send()
        .await
        .map_err(|e| format!("Failed to synthesize audio: {}", e))?;

    if !synthesis_response.status().is_success() {
        return Err(format!("Synthesis failed with status: {}", synthesis_response.status()));
    }

    let audio_data = synthesis_response.bytes().await
        .map_err(|e| format!("Failed to read audio data: {}", e))?;

    Ok(audio_data.to_vec())
}

// 天気情報を取得（東京エリア）
#[tauri::command]
async fn fetch_weather() -> Result<serde_json::Value, String> {
    println!("Fetching weather for Tokyo...");

    // Open-Meteo API（無料、APIキー不要）
    // 東京の座標: 35.6762, 139.6503
    let weather_url = "https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&current=temperature_2m,weathercode&timezone=Asia/Tokyo";

    let client = reqwest::Client::new();
    let response = client.get(weather_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch weather: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Weather API failed with status: {}", response.status()));
    }

    let weather_data = response.json::<serde_json::Value>().await
        .map_err(|e| format!("Failed to parse weather data: {}", e))?;

    Ok(weather_data)
}

// Qiitaの記事を取得
#[tauri::command]
async fn fetch_qiita_articles(username: String) -> Result<Vec<Article>, String> {
    println!("Fetching Qiita articles for user: {}", username);

    let qiita_url = format!("https://qiita.com/api/v2/users/{}/items?page=1&per_page=20", username);

    let client = reqwest::Client::new();
    let response = client.get(&qiita_url)
        .header("User-Agent", "desktop-mascot-tauri")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Qiita articles: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Qiita API failed with status: {}", response.status()));
    }

    let qiita_data = response.json::<serde_json::Value>().await
        .map_err(|e| format!("Failed to parse Qiita data: {}", e))?;

    let mut articles = Vec::new();
    if let Some(items) = qiita_data.as_array() {
        for item in items.iter().take(20) {
            let title = item["title"].as_str().unwrap_or("No title").to_string();
            let url = item["url"].as_str().unwrap_or("").to_string();
            let body = item["body"].as_str().unwrap_or("").to_string();

            // 本文の最初の100文字を取得
            let description = if body.len() > 100 {
                format!("{}...", &body[..100])
            } else {
                body
            };

            articles.push(Article {
                title,
                description,
                link: url,
                thumbnail_url: String::new(),
            });
        }
    }

    Ok(articles)
}

// Zennの記事を取得
#[tauri::command]
async fn fetch_zenn_articles(username: String) -> Result<Vec<Article>, String> {
    println!("Fetching Zenn articles for user: {}", username);

    // ZennはRSSフィードを提供している
    let zenn_rss_url = format!("https://zenn.dev/{}/feed", username);

    fetch_rss(zenn_rss_url).await
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
            set_window_position,
            synthesize_speech,
            fetch_weather,
            fetch_qiita_articles,
            fetch_zenn_articles
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
