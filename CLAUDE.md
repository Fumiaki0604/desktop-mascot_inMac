# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a macOS desktop mascot application built with Tauri 2. It displays a transparent, always-on-top window featuring an animated mascot character that shows RSS/tech blog articles with voice synthesis, animations, and weather information. The application uses Rust for the backend and vanilla JavaScript for the frontend.

**Key Features**:
- RSS/Qiita/Zenn article fetching and display
- VOICEVOX voice synthesis integration for article reading
- Lip sync, blinking, and transition animations
- Tokyo weather display
- Idle hop animations
- Multi-tab settings UI

## Development Commands

### Environment Setup
```bash
# Ensure Rust toolchain is in PATH (required for all commands)
export PATH="$HOME/.cargo/bin:$PATH"
```

### Running the Application
```bash
# Development mode (hot reload enabled)
npm run tauri dev

# Production build (creates .app bundle and .dmg installer)
npm run tauri build
```

### Output Locations After Build
- **macOS App**: `src-tauri/target/release/bundle/macos/desktop-mascot-tauri.app`
- **DMG Installer**: `src-tauri/target/release/bundle/dmg/desktop-mascot-tauri_0.1.0_aarch64.dmg`

### Installing Built App
```bash
# Copy to Applications folder for easy access
cp -r "src-tauri/target/release/bundle/macos/desktop-mascot-tauri.app" /Applications/
```

## Architecture

### Frontend-Backend Communication Pattern

The app uses Tauri's command system for frontend-backend communication:

**Frontend (JavaScript)**: Calls Rust commands via `invoke()` from `window.__TAURI__.core`
```javascript
const result = await invoke('command_name', { param: value });
```

**Backend (Rust)**: Commands defined with `#[tauri::command]` in `src-tauri/src/lib.rs`
- Must be registered in the `invoke_handler!` macro in the `run()` function
- Can accept special parameters: `tauri::Window`, `tauri::AppHandle`

### Key Backend Commands

Located in `src-tauri/src/lib.rs`:

1. **`fetch_rss(feed_url: String)`**: Fetches and parses RSS feeds using `reqwest` and `feed-rs`
2. **`open_url(url: String)`**: Opens URLs in default browser using the `open` crate
3. **`select_mascot_image(app: tauri::AppHandle)`**: Shows file picker dialog for image selection
4. **`get_window_position(window: tauri::Window)`**: Returns current window coordinates
5. **`set_window_position(window: tauri::Window, x: i32, y: i32)`**: Moves window to specified position
6. **`synthesize_speech(text: String, speaker_id: u32)`**: VOICEVOX voice synthesis (requires VOICEVOX running on localhost:50021)
7. **`fetch_weather()`**: Fetches Tokyo weather from Open-Meteo API
8. **`fetch_qiita_articles(username: String)`**: Fetches Qiita articles for a user
9. **`fetch_zenn_articles(username: String)`**: Fetches Zenn articles via RSS feed

### Animation System

The mascot supports multiple animation layers that work simultaneously:

**Image Naming Convention**:
- Base image: `mascot.png`
- Mouth frames: `mascot_mouth1.png`, `mascot_mouth2.png`, `mascot_mouth3.png`
- Blink frame: `mascot_blink.png`
- Transition GIF: `mascot_transition.gif`

**Animation Functions** (in `main.js`):
- `loadMouthImages(basePath)` - Loads lip sync frames
- `startLipSync()` / `stopLipSync()` - Controls mouth animation during speech (150ms interval)
- `loadBlinkImage(basePath)` - Loads blink frame
- `startBlinkAnimation()` / `stopBlinkAnimation()` - Random blinking (2-5 second intervals, 200ms duration)
- `loadTransitionGif(basePath)` - Loads transition animation
- `playTransitionAnimation(callback)` - Plays GIF when switching articles (1 second duration)
- `startHopAnimation()` / `stopHopAnimation()` - Idle hopping (10-20 second intervals, 300ms duration)

All animation images are **optional**. If an image file doesn't exist, the animation is skipped gracefully.

### VOICEVOX Integration

The voice synthesis system requires VOICEVOX to be running locally:

1. User clicks "読み上げ" (Speak) button
2. Frontend calls `synthesize_speech()` with article text and speaker ID
3. Backend makes two API calls to `http://localhost:50021`:
   - POST `/audio_query` - Creates voice query
   - POST `/synthesis` - Generates WAV audio
4. Audio data returned as `Vec<u8>`, converted to Blob in frontend
5. Lip sync animation starts when audio plays, stops when audio ends

**Error Handling**: If VOICEVOX is not running, the user gets an alert prompting them to start VOICEVOX.

### State Persistence

The app uses browser `localStorage` for persistence:
- **`rssFeedUrl`**: User's configured RSS feed URL
- **`mascotImagePath`**: Path to selected mascot image
- **`windowPosition`**: JSON array `[x, y]` of window coordinates
- **`voicevoxSpeakerId`**: VOICEVOX speaker ID (1-53)
- **`qiitaUsername`**: Qiita username for article fetching
- **`zennUsername`**: Zenn username for article fetching

Window position is auto-saved on mouse movement with 1-second debounce.

### Multi-Tab Settings UI

The settings dialog uses a tab-based interface (see `index.html`):
- **RSS Tab**: Configure RSS feed URL
- **Qiita Tab**: Configure Qiita username
- **Zenn Tab**: Configure Zenn username
- **Voice Tab**: Configure VOICEVOX speaker ID

Tab switching is handled via `data-tab` attributes and CSS class toggling. Active tab has `.active` class.

### Weather Display

Weather information is displayed in the top-right corner:
- Fetches data from Open-Meteo API (Tokyo coordinates: 35.6762, 139.6503)
- Updates every 30 minutes via `setInterval()`
- Weather codes converted to Japanese descriptions (快晴, 雨, 雪, etc.)
- Temperature displayed in Celsius

### Window Dragging System

The entire window can be dragged by clicking anywhere except interactive elements:

**Implementation**:
1. `<body>` has `data-tauri-drag-region` attribute
2. Interactive elements (buttons, inputs, dialogs) use CSS `-webkit-app-region: no-drag`
3. This allows dragging the background while keeping UI elements clickable

### macOS-Specific Configuration

**Critical**: The app requires macOS Private API for window transparency:

In `src-tauri/Cargo.toml`:
```toml
tauri = { version = "2", features = ["protocol-asset", "macos-private-api"] }
reqwest = { version = "0.12", features = ["blocking", "json"] }
```

In `src-tauri/tauri.conf.json`:
```json
{
  "app": {
    "macOSPrivateApi": true,
    "security": {
      "assetProtocol": { "enable": true, "scope": ["**"] }
    }
  }
}
```

The `assetProtocol` enables loading local images via `asset://localhost/` URLs.

### Window Configuration

The window is configured as a frameless, transparent overlay (see `src-tauri/tauri.conf.json`):
- `decorations: false` - No title bar or window chrome
- `transparent: true` - See-through background
- `alwaysOnTop: true` - Stays above other windows
- `skipTaskbar: true` - Hidden from Dock/taskbar
- `resizable: false` - Fixed size window
- Default size: 800x400

### RSS Parsing Flow

1. Frontend calls `invoke('fetch_rss', { feedUrl })`
2. `fetch_rss()` delegates to `fetch_rss_internal()` which:
   - Fetches content via `reqwest::get()`
   - Parses with `feed_rs::parser::parse()`
   - Extracts title, description, link, and thumbnail from entries
   - Returns up to 30 articles
3. Frontend stores articles and cycles through them on bubble click
4. GIF transition animation plays when navigating between articles

### Event Handling Pattern

All event listeners are set up in `setupEventListeners()` which is called after DOM load:
- Tab buttons → Switch between settings tabs
- Settings button → Opens settings dialog with current values
- Save button → Persists settings and fetches articles based on active tab
- Speak button → Synthesizes speech with VOICEVOX and plays lip sync
- Open link button → Opens article URL in browser
- Image selection → Triggers file picker and saves to localStorage
- Mouse movement → Debounced window position save

## Critical Implementation Notes

### Adding New Tauri Commands

When adding a new Rust command:
1. Define function with `#[tauri::command]` attribute in `src-tauri/src/lib.rs`
2. Add command name to `invoke_handler!` macro in `run()` function
3. Call from frontend using `invoke('command_name', params)`

### Adding New Animations

To add a new animation:
1. Add global variable for animation state (e.g., `let myAnimationInterval = null`)
2. Create `startMyAnimation()` and `stopMyAnimation()` functions
3. Call from appropriate lifecycle hooks (e.g., `DOMContentLoaded`, `setMascotImage()`)
4. Remember to stop existing animations before starting new ones

### Image Loading Requirement

Custom mascot images must use the `asset://` protocol:
```javascript
mascotImage.src = `asset://localhost/${imagePath}`;
```
This requires `assetProtocol` enabled in security settings.

### Window Position Coordinate System

`outer_position()` returns screen coordinates where (0,0) is typically the top-left of the primary display. Negative coordinates are possible on multi-monitor setups.

### URL Encoding for API Calls

Text sent to VOICEVOX must be URL-encoded using the `urlencoding` crate:
```rust
let query_url = format!("http://localhost:50021/audio_query?text={}&speaker={}",
    urlencoding::encode(&text), speaker_id);
```

## Dependencies

**Rust Backend**:
- `tauri` (v2) - Main framework with `protocol-asset` and `macos-private-api` features
- `feed-rs` - RSS/Atom feed parsing
- `reqwest` - HTTP client with `blocking` and `json` features
- `tauri-plugin-dialog` - Native file picker dialogs
- `tauri-plugin-opener` - URL/file opening
- `open` - Cross-platform URL opening
- `serde` / `serde_json` - Serialization
- `tokio` - Async runtime with `full` features
- `urlencoding` - URL encoding for API requests

**Frontend**:
- Vanilla JavaScript (no framework)
- Tauri API via global `window.__TAURI__`
- Web Audio API for audio playback
- LocalStorage for state persistence
