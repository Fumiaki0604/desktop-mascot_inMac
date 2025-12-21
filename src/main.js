// Tauri APIのインポート
const { invoke } = window.__TAURI__.core;

// 記事データ
let articles = [
  {
    title: 'デスクトップマスコットへようこそ',
    description: 'Tauri版デスクトップマスコットが起動しました。RSSフィードを設定すると記事が表示されます。',
    link: '',
    thumbnailUrl: ''
  }
];
let currentIndex = 0;

function setupEventListeners() {
  // 記事を開くボタン
  const openLinkBtn = document.getElementById('open-link-btn');
  if (openLinkBtn) {
    openLinkBtn.addEventListener('click', () => {
      const article = articles[currentIndex];
      if (article && article.link) {
        // Tauriでリンクを開く
        invoke('open_url', { url: article.link });
      }
    });
  }

  // 吹き出しクリックで次の記事
  const bubble = document.getElementById('bubble');
  if (bubble) {
    bubble.addEventListener('click', (e) => {
      if (e.target.id !== 'open-link-btn') {
        nextArticle();
      }
    });
  }

  // 画像選択ボタン
  const selectImageBtn = document.getElementById('select-image-btn');
  if (selectImageBtn) {
    selectImageBtn.addEventListener('click', async () => {
      try {
        const imagePath = await invoke('select_mascot_image');
        if (imagePath) {
          setMascotImage(imagePath);
          // localStorageに保存
          localStorage.setItem('mascotImagePath', imagePath);
        }
      } catch (error) {
        console.error('Failed to select image:', error);
      }
    });
  }

  // 設定ボタン
  const settingsBtn = document.getElementById('settings-btn');
  const settingsDialog = document.getElementById('settings-dialog');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
  const rssFeedInput = document.getElementById('rss-feed-input');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      // 現在のRSSフィードURLを表示
      const currentFeed = localStorage.getItem('rssFeedUrl') || 'https://www.nhk.or.jp/rss/news/cat0.xml';
      rssFeedInput.value = currentFeed;
      settingsDialog.style.display = 'flex';
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const newFeedUrl = rssFeedInput.value.trim();
      if (newFeedUrl) {
        localStorage.setItem('rssFeedUrl', newFeedUrl);
        fetchRSS(newFeedUrl);
        settingsDialog.style.display = 'none';
      }
    });
  }

  if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener('click', () => {
      settingsDialog.style.display = 'none';
    });
  }

  // 右クリックメニュー
  const contextMenu = document.getElementById('context-menu');

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
  });

  document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });

  const menuSettings = document.getElementById('menu-settings');
  if (menuSettings) {
    menuSettings.addEventListener('click', () => {
      settingsBtn.click();
    });
  }

  const menuSelectImage = document.getElementById('menu-select-image');
  if (menuSelectImage) {
    menuSelectImage.addEventListener('click', () => {
      selectImageBtn.click();
    });
  }

  const menuExit = document.getElementById('menu-exit');
  if (menuExit) {
    menuExit.addEventListener('click', () => {
      window.close();
    });
  }
}

function displayCurrentArticle() {
  const article = articles[currentIndex];
  if (!article) return;

  const articleText = document.getElementById('article-text');
  if (!articleText) return;

  // テキスト表示
  let displayText = article.title;
  if (article.description) {
    displayText += '\n\n' + article.description;
  }
  articleText.textContent = displayText;

  // サムネイル表示
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

function nextArticle() {
  currentIndex = (currentIndex + 1) % articles.length;
  displayCurrentArticle();
}

function previousArticle() {
  currentIndex = (currentIndex - 1 + articles.length) % articles.length;
  displayCurrentArticle();
}

// マスコット画像を設定
function setMascotImage(imagePath) {
  const mascotImage = document.getElementById('mascot-image');
  const defaultMascot = document.getElementById('default-mascot');

  if (mascotImage && imagePath) {
    mascotImage.src = `asset://localhost/${imagePath}`;
    mascotImage.style.display = 'block';
    if (defaultMascot) {
      defaultMascot.style.display = 'none';
    }
  }
}

// 保存済みマスコット画像を復元
function restoreMascotImage() {
  const savedPath = localStorage.getItem('mascotImagePath');
  if (savedPath) {
    setMascotImage(savedPath);
  }
}

// RSS取得機能
async function fetchRSS(feedUrl) {
  try {
    console.log('Fetching RSS from:', feedUrl);
    const fetchedArticles = await invoke('fetch_rss', { feedUrl });

    // 記事を追加
    articles = fetchedArticles.map(article => ({
      title: article.title,
      description: article.description,
      link: article.link,
      thumbnailUrl: article.thumbnail_url
    }));

    currentIndex = 0;
    displayCurrentArticle();
    console.log(`Loaded ${articles.length} articles`);
  } catch (error) {
    console.error('Failed to fetch RSS:', error);
  }
}

// ウィンドウ位置を保存
async function saveWindowPosition() {
  try {
    const position = await invoke('get_window_position');
    localStorage.setItem('windowPosition', JSON.stringify(position));
  } catch (error) {
    console.error('Failed to save window position:', error);
  }
}

// ウィンドウ位置を復元
async function restoreWindowPosition() {
  try {
    const savedPosition = localStorage.getItem('windowPosition');
    if (savedPosition) {
      const [x, y] = JSON.parse(savedPosition);
      await invoke('set_window_position', { x, y });
      console.log(`Restored window position: ${x}, ${y}`);
    }
  } catch (error) {
    console.error('Failed to restore window position:', error);
  }
}

// テスト用：アプリ起動時にRSSを取得
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Desktop Mascot loaded');

  // ウィンドウ位置を復元
  await restoreWindowPosition();

  // 保存済みマスコット画像を復元
  restoreMascotImage();

  // 保存済みRSSフィードURLまたはデフォルトを取得
  const rssFeedUrl = localStorage.getItem('rssFeedUrl') || 'https://www.nhk.or.jp/rss/news/cat0.xml';
  fetchRSS(rssFeedUrl);

  displayCurrentArticle();
  setupEventListeners();

  // ウィンドウ移動時に位置を保存
  let saveTimer;
  window.addEventListener('mousemove', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWindowPosition, 1000);
  });
});
