// Tauri APIのインポート
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { emit, listen } = window.__TAURI__.event;

// 記事データ
let articles = [
  {
    title: 'デスクトップマスコットへようこそ',
    description: 'Tauri版デスクトップマスコットが起動しました。RSSフィードを設定すると記事が表示されます。',
    link: '',
    thumbnailUrl: '',
    source: 'アプリ'
  }
];
let currentIndex = 0;

// 音声再生用
let currentAudio = null;
let autoAdvanceInterval = null;
const AUTO_ADVANCE_MS = 20000;

// ウィンドウドラッグ機能
function setupWindowDrag() {
  const container = document.getElementById('bubble-container');
  if (!container) return;

  let isDragging = false;
  let startMousePos = { x: 0, y: 0 };
  let startWindowPos = { x: 0, y: 0 };

  container.addEventListener('mousedown', async (e) => {
    if (e.target.tagName === 'BUTTON') return;

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
    localStorage.setItem('bubble-window-position', JSON.stringify({ x: position.x, y: position.y }));
  } catch (error) {
    console.error('Failed to save window position:', error);
  }
}

// ウィンドウ位置を復元
async function restoreWindowPosition() {
  try {
    const savedPosition = localStorage.getItem('bubble-window-position');
    if (savedPosition) {
      const { x, y } = JSON.parse(savedPosition);
      const window = getCurrentWindow();
      await window.setPosition({ type: 'Physical', x, y });
    }
  } catch (error) {
    console.error('Failed to restore window position:', error);
  }
}

// 記事表示
function displayCurrentArticle() {
  const article = articles[currentIndex];
  if (!article) return;

  const articleText = document.getElementById('article-text');
  if (!articleText) return;

  let displayText = article.title;
  if (article.description) {
    displayText += '\n\n' + article.description;
  }
  if (article.source) {
    displayText += '\n\n出典: ' + article.source;
  }
  articleText.textContent = displayText;

  const thumbnailContainer = document.getElementById('thumbnail-container');
  if (thumbnailContainer) {
    thumbnailContainer.innerHTML = '';
    if (article.thumbnailUrl) {
      const img = document.createElement('img');
      img.src = article.thumbnailUrl;
      thumbnailContainer.appendChild(img);
    }
  }
}

// 記事切り替え
function nextArticle() {
  // マスコットウィンドウにアニメーション再生を通知
  emit('play-transition-animation');

  currentIndex = (currentIndex + 1) % articles.length;
  displayCurrentArticle();
  resetAutoAdvance();
}

function previousArticle() {
  emit('play-transition-animation');

  currentIndex = (currentIndex - 1 + articles.length) % articles.length;
  displayCurrentArticle();
  resetAutoAdvance();
}

// 自動送り
function startAutoAdvance() {
  if (articles.length <= 1) {
    stopAutoAdvance();
    return;
  }
  stopAutoAdvance();
  autoAdvanceInterval = setInterval(() => {
    if (articles.length <= 1) return;
    nextArticle();
  }, AUTO_ADVANCE_MS);
}

function stopAutoAdvance() {
  if (autoAdvanceInterval) {
    clearInterval(autoAdvanceInterval);
    autoAdvanceInterval = null;
  }
}

function resetAutoAdvance() {
  stopAutoAdvance();
  startAutoAdvance();
}

// イベントリスナー設定
function setupEventListeners() {
  // 読み上げボタン
  const speakBtn = document.getElementById('speak-btn');
  if (speakBtn) {
    speakBtn.addEventListener('click', async () => {
      const article = articles[currentIndex];
      if (!article) return;

      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        emit('stop-lip-sync');
      }

      try {
        speakBtn.textContent = '合成中...';
        speakBtn.disabled = true;

        const textToSpeak = `${article.title}。${article.description}`;
        const speakerId = parseInt(localStorage.getItem('voicevoxSpeakerId') || '1');

        const audioData = await invoke('synthesize_speech', {
          text: textToSpeak,
          speakerId: speakerId
        });

        const blob = new Blob([new Uint8Array(audioData)], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);

        currentAudio = new Audio(audioUrl);
        currentAudio.play();

        speakBtn.textContent = '再生中...';

        // マスコットウィンドウにリップシンク開始を通知
        emit('start-lip-sync');

        currentAudio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
          speakBtn.textContent = '読み上げ';
          speakBtn.disabled = false;
          currentAudio = null;
          emit('stop-lip-sync');
        });

      } catch (error) {
        console.error('Speech synthesis failed:', error);
        alert(`音声合成に失敗しました: ${error}\n\nVOICEVOXが起動していることを確認してください。`);
        speakBtn.textContent = '読み上げ';
        speakBtn.disabled = false;
        emit('stop-lip-sync');
      }
    });
  }

  // 記事を開くボタン
  const openLinkBtn = document.getElementById('open-link-btn');
  if (openLinkBtn) {
    openLinkBtn.addEventListener('click', () => {
      const article = articles[currentIndex];
      if (article && article.link) {
        invoke('open_url', { url: article.link });
      }
    });
  }

  // 吹き出しクリックで次の記事
  const bubble = document.getElementById('bubble');
  if (bubble) {
    bubble.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        nextArticle();
      }
    });
  }
}

// 設定変更イベントをリッスン
async function setupEventSubscriptions() {
  // 記事更新イベント
  await listen('articles-updated', (event) => {
    articles = event.payload;
    currentIndex = 0;
    displayCurrentArticle();
    startAutoAdvance();
    console.log(`Received ${articles.length} articles`);
  });
}

// RSS取得
async function fetchRSS(feedUrl) {
  try {
    console.log('Fetching RSS from:', feedUrl);
    const fetchedArticles = await invoke('fetch_rss', { feedUrl });

    articles = fetchedArticles.map(article => ({
      title: article.title,
      description: article.description,
      link: article.link,
      thumbnailUrl: article.thumbnail_url,
      source: article.source
    }));

    currentIndex = 0;
    displayCurrentArticle();
    startAutoAdvance();
    console.log(`Loaded ${articles.length} articles`);
  } catch (error) {
    console.error('Failed to fetch RSS:', error);
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Bubble window loaded');

  await restoreWindowPosition();
  setupWindowDrag();
  setupEventListeners();
  await setupEventSubscriptions();

  // 保存済みRSSフィードURLまたはデフォルトを取得
  const rssFeedUrl = localStorage.getItem('rssFeedUrl') || 'https://www.nhk.or.jp/rss/news/cat0.xml';
  fetchRSS(rssFeedUrl);

  displayCurrentArticle();
});
