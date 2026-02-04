// Tauri APIのインポート
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow, Window } = window.__TAURI__.window;
const { emit, listen } = window.__TAURI__.event;

// アニメーション用変数
let lipSyncInterval = null;
let mouthImages = [];
let blinkInterval = null;
let blinkImagePath = null;
let transitionGifPath = null;
let hopInterval = null;

// ウィンドウドラッグ機能
function setupWindowDrag() {
  const container = document.getElementById('mascot-container');
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
    localStorage.setItem('mascot-window-position', JSON.stringify({ x: position.x, y: position.y }));
  } catch (error) {
    console.error('Failed to save window position:', error);
  }
}

// ウィンドウ位置を復元
async function restoreWindowPosition() {
  try {
    const savedPosition = localStorage.getItem('mascot-window-position');
    if (savedPosition) {
      const { x, y } = JSON.parse(savedPosition);
      const window = getCurrentWindow();
      await window.setPosition({ type: 'Physical', x, y });
    }
  } catch (error) {
    console.error('Failed to restore window position:', error);
  }
}

// 口パク用画像を読み込む
function loadMouthImages(basePath) {
  mouthImages = [];
  const pathParts = basePath.split('.');
  const extension = pathParts.pop();
  const basePathWithoutExt = pathParts.join('.');

  for (let i = 1; i <= 3; i++) {
    const mouthPath = `${basePathWithoutExt}_mouth${i}.${extension}`;
    mouthImages.push(mouthPath);
  }
  console.log(`Loaded ${mouthImages.length} mouth animation frames`);
}

// リップシンク開始
function startLipSync() {
  if (mouthImages.length === 0) return;

  const mascotMouth = document.getElementById('mascot-mouth');
  if (!mascotMouth) return;

  let currentMouthIndex = 0;
  lipSyncInterval = setInterval(() => {
    if (mouthImages.length > 0) {
      mascotMouth.src = `asset://localhost/${mouthImages[currentMouthIndex]}`;
      mascotMouth.style.display = 'block';
      currentMouthIndex = (currentMouthIndex + 1) % mouthImages.length;
    }
  }, 150);
}

// リップシンク停止
function stopLipSync() {
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
    lipSyncInterval = null;
  }
  const mascotMouth = document.getElementById('mascot-mouth');
  if (mascotMouth) mascotMouth.style.display = 'none';
}

// 瞬き用画像を読み込む
function loadBlinkImage(basePath) {
  const pathParts = basePath.split('.');
  const extension = pathParts.pop();
  const basePathWithoutExt = pathParts.join('.');
  blinkImagePath = `${basePathWithoutExt}_blink.${extension}`;
  console.log(`Loaded blink image: ${blinkImagePath}`);
}

// 瞬きアニメーション開始
function startBlinkAnimation() {
  if (!blinkImagePath) return;

  const mascotBlink = document.getElementById('mascot-blink');
  if (!mascotBlink) return;

  const scheduleNextBlink = () => {
    const randomInterval = Math.random() * 3000 + 2000;
    blinkInterval = setTimeout(() => {
      performBlink();
      scheduleNextBlink();
    }, randomInterval);
  };

  const performBlink = () => {
    mascotBlink.src = `asset://localhost/${blinkImagePath}`;
    mascotBlink.style.display = 'block';
    setTimeout(() => {
      mascotBlink.style.display = 'none';
    }, 200);
  };

  scheduleNextBlink();
}

// 瞬きアニメーション停止
function stopBlinkAnimation() {
  if (blinkInterval) {
    clearTimeout(blinkInterval);
    blinkInterval = null;
  }
  const mascotBlink = document.getElementById('mascot-blink');
  if (mascotBlink) mascotBlink.style.display = 'none';
}

// トランジションGIF読み込み
function loadTransitionGif() {
  transitionGifPath = 'image/voidoll.gif';
  console.log(`Loaded transition GIF: ${transitionGifPath}`);
}

// トランジションアニメーション再生
function playTransitionAnimation() {
  if (!transitionGifPath) return;

  const transitionGif = document.getElementById('transition-gif');
  if (!transitionGif) return;

  const mascotImage = document.getElementById('mascot-image');
  const defaultMascot = document.getElementById('default-mascot');
  const originalMascotDisplay = mascotImage ? mascotImage.style.display : 'none';
  const originalDefaultDisplay = defaultMascot ? defaultMascot.style.display : 'flex';

  if (mascotImage) mascotImage.style.display = 'none';
  if (defaultMascot) defaultMascot.style.display = 'none';

  transitionGif.src = transitionGifPath;
  transitionGif.style.display = 'block';

  setTimeout(() => {
    transitionGif.style.display = 'none';
    if (mascotImage) mascotImage.style.display = originalMascotDisplay;
    if (defaultMascot) defaultMascot.style.display = originalDefaultDisplay;
  }, 1000);
}

// ホップアニメーション開始
function startHopAnimation() {
  const mascotContainer = document.getElementById('mascot-container');
  if (!mascotContainer) return;

  const scheduleNextHop = () => {
    const randomInterval = Math.random() * 10000 + 10000;
    hopInterval = setTimeout(() => {
      performHop();
      scheduleNextHop();
    }, randomInterval);
  };

  const performHop = () => {
    mascotContainer.style.transition = 'transform 0.3s ease-out';
    mascotContainer.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      mascotContainer.style.transform = 'translateY(0)';
    }, 300);
  };

  scheduleNextHop();
}

// マスコット画像を設定
function setMascotImage(imagePath) {
  const mascotImage = document.getElementById('mascot-image');
  const defaultMascot = document.getElementById('default-mascot');

  if (mascotImage && imagePath) {
    mascotImage.src = `asset://localhost/${imagePath}`;
    mascotImage.style.display = 'block';
    if (defaultMascot) defaultMascot.style.display = 'none';

    stopBlinkAnimation();
    loadMouthImages(imagePath);
    loadBlinkImage(imagePath);
    loadTransitionGif();
    startBlinkAnimation();
  }
}

// 保存済みマスコット画像を復元
function restoreMascotImage() {
  const savedPath = localStorage.getItem('mascotImagePath');
  if (savedPath) setMascotImage(savedPath);
}

// イベントリスナー設定
function setupEventListeners() {
  // 画像選択ボタン
  const selectImageBtn = document.getElementById('select-image-btn');
  if (selectImageBtn) {
    selectImageBtn.addEventListener('click', async () => {
      try {
        const imagePath = await invoke('select_mascot_image');
        if (imagePath) {
          setMascotImage(imagePath);
          localStorage.setItem('mascotImagePath', imagePath);
        }
      } catch (error) {
        console.error('Failed to select image:', error);
      }
    });
  }

  // タブ切り替え
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });

  // 設定ボタン
  const settingsBtn = document.getElementById('settings-btn');
  const settingsDialog = document.getElementById('settings-dialog');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
  const rssFeedInput = document.getElementById('rss-feed-input');
  const qiitaUsernameInput = document.getElementById('qiita-username-input');
  const zennUsernameInput = document.getElementById('zenn-username-input');
  const speakerIdInput = document.getElementById('speaker-id-input');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const currentFeed = localStorage.getItem('rssFeedUrl') || 'https://www.nhk.or.jp/rss/news/cat0.xml';
      const currentSpeakerId = localStorage.getItem('voicevoxSpeakerId') || '1';
      const currentQiitaUsername = localStorage.getItem('qiitaUsername') || '';
      const currentZennUsername = localStorage.getItem('zennUsername') || '';

      rssFeedInput.value = currentFeed;
      speakerIdInput.value = currentSpeakerId;
      qiitaUsernameInput.value = currentQiitaUsername;
      zennUsernameInput.value = currentZennUsername;
      settingsDialog.style.display = 'flex';
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      const newFeedUrl = rssFeedInput.value.trim();
      const newSpeakerId = speakerIdInput.value;
      const newQiitaUsername = qiitaUsernameInput.value.trim();
      const newZennUsername = zennUsernameInput.value.trim();

      if (newFeedUrl) localStorage.setItem('rssFeedUrl', newFeedUrl);
      localStorage.setItem('voicevoxSpeakerId', newSpeakerId);
      if (newQiitaUsername) localStorage.setItem('qiitaUsername', newQiitaUsername);
      if (newZennUsername) localStorage.setItem('zennUsername', newZennUsername);

      // アクティブなタブに応じて記事を取得してbubbleウィンドウに通知
      const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
      let articles = [];

      try {
        if (activeTab === 'rss' && newFeedUrl) {
          articles = await invoke('fetch_rss', { feedUrl: newFeedUrl });
        } else if (activeTab === 'qiita' && newQiitaUsername) {
          articles = await invoke('fetch_qiita_articles', { username: newQiitaUsername });
        } else if (activeTab === 'zenn' && newZennUsername) {
          articles = await invoke('fetch_zenn_articles', { username: newZennUsername });
        }

        if (articles.length > 0) {
          const formattedArticles = articles.map(article => ({
            title: article.title,
            description: article.description,
            link: article.link,
            thumbnailUrl: article.thumbnail_url,
            source: article.source
          }));
          emit('articles-updated', formattedArticles);
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error);
        alert(`記事の取得に失敗しました: ${error}`);
      }

      settingsDialog.style.display = 'none';
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
    menuExit.addEventListener('click', async () => {
      // すべてのウィンドウを閉じる
      try {
        const bubbleWindow = new Window('bubble');
        const weatherWindow = new Window('weather');
        await bubbleWindow.close();
        await weatherWindow.close();
      } catch (e) {
        console.log('Some windows may already be closed');
      }
      const currentWin = getCurrentWindow();
      await currentWin.close();
    });
  }
}

// イベント購読
async function setupEventSubscriptions() {
  // リップシンク開始
  await listen('start-lip-sync', () => {
    startLipSync();
  });

  // リップシンク停止
  await listen('stop-lip-sync', () => {
    stopLipSync();
  });

  // トランジションアニメーション再生
  await listen('play-transition-animation', () => {
    playTransitionAnimation();
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Mascot window loaded');

  await restoreWindowPosition();
  setupWindowDrag();
  setupEventListeners();
  await setupEventSubscriptions();

  restoreMascotImage();
  loadTransitionGif();
  startHopAnimation();
});
