// Tauri APIのインポート
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

// ウィンドウドラッグ機能
function setupWindowDrag() {
  const container = document.getElementById('weather-container');
  if (!container) return;

  let isDragging = false;
  let startMousePos = { x: 0, y: 0 };
  let startWindowPos = { x: 0, y: 0 };

  container.addEventListener('mousedown', async (e) => {
    isDragging = true;
    startMousePos = { x: e.screenX, y: e.screenY };

    try {
      const window = getCurrentWindow();
      const position = await window.outerPosition();
      startWindowPos = { x: position.x, y: position.y };
    } catch (error) {
      console.error('Failed to get window position:', error);
      return;
    }

    e.preventDefault();
  });

  document.addEventListener('mousemove', async (e) => {
    if (!isDragging) return;

    const deltaX = e.screenX - startMousePos.x;
    const deltaY = e.screenY - startMousePos.y;

    const newX = startWindowPos.x + deltaX;
    const newY = startWindowPos.y + deltaY;

    try {
      const window = getCurrentWindow();
      await window.setPosition({ type: 'Physical', x: newX, y: newY });
    } catch (error) {
      console.error('Failed to set window position:', error);
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      saveWindowPosition();
    }
  });
}

// ウィンドウ位置を保存
async function saveWindowPosition() {
  try {
    const window = getCurrentWindow();
    const position = await window.outerPosition();
    localStorage.setItem('weather-window-position', JSON.stringify({ x: position.x, y: position.y }));
  } catch (error) {
    console.error('Failed to save window position:', error);
  }
}

// ウィンドウ位置を復元
async function restoreWindowPosition() {
  try {
    const savedPosition = localStorage.getItem('weather-window-position');
    if (savedPosition) {
      const { x, y } = JSON.parse(savedPosition);
      const window = getCurrentWindow();
      await window.setPosition({ type: 'Physical', x, y });
    }
  } catch (error) {
    console.error('Failed to restore window position:', error);
  }
}

// 天気情報を取得
async function fetchWeather() {
  try {
    console.log('Fetching weather...');
    const weatherData = await invoke('fetch_weather');

    const temp = weatherData.current.temperature_2m;
    const weatherCode = weatherData.current.weathercode;

    const weatherDescriptions = {
      0: '快晴', 1: '晴れ', 2: '晴れ', 3: '曇り',
      45: '霧', 48: '霧',
      51: '小雨', 53: '雨', 55: '大雨',
      61: '小雨', 63: '雨', 65: '大雨',
      71: '小雪', 73: '雪', 75: '大雪', 77: '雪',
      80: 'にわか雨', 81: 'にわか雨', 82: 'にわか雨',
      85: 'にわか雪', 86: 'にわか雪',
      95: '雷雨', 96: '雷雨', 99: '雷雨'
    };

    const weatherDesc = weatherDescriptions[weatherCode] || '不明';

    const tempElement = document.getElementById('weather-temp');
    const descElement = document.getElementById('weather-desc');

    if (tempElement) tempElement.textContent = `${Math.round(temp)}°C`;
    if (descElement) descElement.textContent = `東京: ${weatherDesc}`;

    console.log(`Weather updated: ${temp}°C, ${weatherDesc}`);
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    const descElement = document.getElementById('weather-desc');
    if (descElement) descElement.textContent = '取得失敗';
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Weather window loaded');

  await restoreWindowPosition();
  setupWindowDrag();

  // 天気情報を取得
  fetchWeather();
  // 30分ごとに更新
  setInterval(fetchWeather, 30 * 60 * 1000);
});
