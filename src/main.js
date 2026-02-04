// Tauri APIのインポート
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

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

// 音声再生用のAudioコンテキスト
let currentAudio = null;
let autoAdvanceInterval = null;
const AUTO_ADVANCE_MS = 20000;
let lipSyncInterval = null;
let mouthImages = []; // 口パク用画像パスのリスト
let blinkInterval = null;
let blinkImagePath = null; // 瞬き用画像パス
let transitionGifPath = null; // 記事切り替え時のGIFパス
let hopInterval = null; // ホップアニメーション用タイマー

// 各要素の位置を復元
function restoreElementPositions() {
  const elements = [
    { id: 'mascot-container', defaultPos: null },
    { id: 'bubble-container', defaultPos: null },
    { id: 'weather-container', defaultPos: null }
  ];

  // 画面サイズを取得
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  elements.forEach(({ id }) => {
    const element = document.getElementById(id);
    if (!element) return;

    const savedPos = localStorage.getItem(`${id}-position`);
    if (savedPos) {
      const { left, top } = JSON.parse(savedPos);

      // 要素のサイズを取得（まだ配置されていない場合でも取得可能）
      const rect = element.getBoundingClientRect();
      const elementWidth = rect.width;
      const elementHeight = rect.height;

      // 少なくとも50pxは画面内に表示されるようにする
      const minVisible = 50;
      let clampedLeft = left;
      let clampedTop = top;

      // 右側にはみ出している場合
      if (left > screenWidth - minVisible) {
        clampedLeft = screenWidth - minVisible;
      }
      // 左側にはみ出している場合
      if (left + elementWidth < minVisible) {
        clampedLeft = minVisible - elementWidth;
      }
      // 下側にはみ出している場合
      if (top > screenHeight - minVisible) {
        clampedTop = screenHeight - minVisible;
      }
      // 上側にはみ出している場合
      if (top + elementHeight < minVisible) {
        clampedTop = minVisible - elementHeight;
      }

      element.style.left = `${clampedLeft}px`;
      element.style.top = `${clampedTop}px`;
    }
  });
}

// 各要素の位置を保存
function saveElementPosition(elementId, left, top) {
  localStorage.setItem(`${elementId}-position`, JSON.stringify({ left, top }));
}

// ドラッグ可能エリアの設定（各要素を個別に移動）
function setupDraggableAreas() {
  const draggableElements = [
    { element: document.getElementById('mascot-container'), id: 'mascot-container' },
    { element: document.getElementById('bubble'), id: 'bubble-container' },
    { element: document.getElementById('weather-container'), id: 'weather-container' }
  ];

  let currentDragging = null;
  let startMousePos = { x: 0, y: 0 };
  let startElementPos = { left: 0, top: 0 };

  draggableElements.forEach(({ element, id }) => {
    if (!element) return;

    element.addEventListener('mousedown', (e) => {
      // ボタンや入力フィールド、リンクのクリックは無視
      if (e.target.tagName === 'BUTTON' ||
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'A' ||
          e.target.closest('#settings-dialog') ||
          e.target.closest('#context-menu')) {
        return;
      }

      currentDragging = { element, id };
      startMousePos = { x: e.clientX, y: e.clientY };

      // 要素の親コンテナを取得（bubble の場合は bubble-container）
      const container = id === 'bubble-container'
        ? document.getElementById('bubble-container')
        : element;

      const rect = container.getBoundingClientRect();
      startElementPos = {
        left: rect.left,
        top: rect.top
      };

      e.preventDefault();
      e.stopPropagation();
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!currentDragging) return;

    const deltaX = e.clientX - startMousePos.x;
    const deltaY = e.clientY - startMousePos.y;

    const newLeft = startElementPos.left + deltaX;
    const newTop = startElementPos.top + deltaY;

    // 要素の親コンテナを移動
    const container = currentDragging.id === 'bubble-container'
      ? document.getElementById('bubble-container')
      : currentDragging.element;

    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
  });

  document.addEventListener('mouseup', () => {
    if (currentDragging) {
      // 位置を保存
      const container = currentDragging.id === 'bubble-container'
        ? document.getElementById('bubble-container')
        : currentDragging.element;

      const rect = container.getBoundingClientRect();
      saveElementPosition(currentDragging.id, rect.left, rect.top);
    }
    currentDragging = null;
  });

  // ウィンドウ全体のドラッグ（背景部分）
  document.body.addEventListener('mousedown', async (e) => {
    // 要素上でのクリックは無視
    if (e.target !== document.body && e.target.id !== 'app') {
      return;
    }

    let isDragging = true;
    const startMousePos = { x: e.screenX, y: e.screenY };
    let startWindowPos = { x: 0, y: 0 };

    try {
      const position = await invoke('get_window_position');
      startWindowPos = { x: position[0], y: position[1] };
    } catch (error) {
      console.error('Failed to get window position:', error);
      return;
    }

    const onMouseMove = async (e) => {
      if (!isDragging) return;

      const deltaX = e.screenX - startMousePos.x;
      const deltaY = e.screenY - startMousePos.y;

      const newX = startWindowPos.x + deltaX;
      const newY = startWindowPos.y + deltaY;

      try {
        await invoke('set_window_position', { x: newX, y: newY });
      } catch (error) {
        console.error('Failed to set window position:', error);
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    e.preventDefault();
  });
}

function setupEventListeners() {
  // 読み上げボタン
  const speakBtn = document.getElementById('speak-btn');
  if (speakBtn) {
    speakBtn.addEventListener('click', async () => {
      const article = articles[currentIndex];
      if (!article) return;

      // 既に再生中の音声があれば停止
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        stopLipSync();
      }

      try {
        speakBtn.textContent = '合成中...';
        speakBtn.disabled = true;

        // タイトルと説明を結合して読み上げ
        const textToSpeak = `${article.title}。${article.description}`;
        const speakerId = parseInt(localStorage.getItem('voicevoxSpeakerId') || '1');

        // VOICEVOX APIで音声合成
        const audioData = await invoke('synthesize_speech', {
          text: textToSpeak,
          speakerId: speakerId
        });

        // Base64デコード不要、直接Blob作成
        const blob = new Blob([new Uint8Array(audioData)], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);

        currentAudio = new Audio(audioUrl);
        currentAudio.play();

        speakBtn.textContent = '再生中...';

        // リップシンクアニメーション開始
        startLipSync();

        currentAudio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
          speakBtn.textContent = '読み上げ';
          speakBtn.disabled = false;
          currentAudio = null;

          // リップシンクアニメーション停止
          stopLipSync();
        });

      } catch (error) {
        console.error('Speech synthesis failed:', error);
        alert(`音声合成に失敗しました: ${error}\n\nVOICEVOXが起動していることを確認してください。`);
        speakBtn.textContent = '読み上げ';
        speakBtn.disabled = false;
        stopLipSync();
      }
    });
  }

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
      // ボタンクリックの場合は記事切り替えしない
      if (e.target.tagName !== 'BUTTON') {
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

  // タブ切り替え
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // すべてのタブとコンテンツから active を削除
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // クリックされたタブとそのコンテンツに active を追加
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
      // 現在の設定を表示
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
    saveSettingsBtn.addEventListener('click', () => {
      const newFeedUrl = rssFeedInput.value.trim();
      const newSpeakerId = speakerIdInput.value;
      const newQiitaUsername = qiitaUsernameInput.value.trim();
      const newZennUsername = zennUsernameInput.value.trim();

      // 保存
      if (newFeedUrl) localStorage.setItem('rssFeedUrl', newFeedUrl);
      localStorage.setItem('voicevoxSpeakerId', newSpeakerId);
      if (newQiitaUsername) localStorage.setItem('qiitaUsername', newQiitaUsername);
      if (newZennUsername) localStorage.setItem('zennUsername', newZennUsername);

      // アクティブなタブに応じて記事を取得
      const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
      if (activeTab === 'rss' && newFeedUrl) {
        fetchRSS(newFeedUrl);
      } else if (activeTab === 'qiita' && newQiitaUsername) {
        fetchQiitaArticles(newQiitaUsername);
      } else if (activeTab === 'zenn' && newZennUsername) {
        fetchZennArticles(newZennUsername);
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
  if (article.source) {
    displayText += '\n\n出典: ' + article.source;
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
  // GIFアニメーションを再生してから記事を切り替え
  playTransitionAnimation(() => {
    currentIndex = (currentIndex + 1) % articles.length;
    displayCurrentArticle();
  });
  resetAutoAdvance();
}

function previousArticle() {
  // GIFアニメーションを再生してから記事を切り替え
  playTransitionAnimation(() => {
    currentIndex = (currentIndex - 1 + articles.length) % articles.length;
    displayCurrentArticle();
  });
  resetAutoAdvance();
}

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
  if (autoAdvanceInterval) {
    clearInterval(autoAdvanceInterval);
    autoAdvanceInterval = null;
  }
  startAutoAdvance();
}

// 口パク用画像を読み込む
async function loadMouthImages(basePath) {
  mouthImages = [];

  // 画像パスから拡張子を除去してベース名を取得
  const pathParts = basePath.split('.');
  const extension = pathParts.pop();
  const basePathWithoutExt = pathParts.join('.');

  // _mouth1.png, _mouth2.png, _mouth3.png を試行
  for (let i = 1; i <= 3; i++) {
    const mouthPath = `${basePathWithoutExt}_mouth${i}.${extension}`;
    // 画像の存在確認は実際のロード試行で行う（フォールバックとして）
    mouthImages.push(mouthPath);
  }

  console.log(`Loaded ${mouthImages.length} mouth animation frames`);
}

// リップシンクアニメーションを開始
function startLipSync() {
  if (mouthImages.length === 0) {
    console.log('No mouth images available for lip sync');
    return;
  }

  const mascotMouth = document.getElementById('mascot-mouth');
  if (!mascotMouth) return;

  let currentMouthIndex = 0;

  // 口パクアニメーションを開始
  lipSyncInterval = setInterval(() => {
    if (mouthImages.length > 0) {
      mascotMouth.src = `asset://localhost/${mouthImages[currentMouthIndex]}`;
      mascotMouth.style.display = 'block';
      currentMouthIndex = (currentMouthIndex + 1) % mouthImages.length;
    }
  }, 150); // 150msごとに口の形を変える
}

// リップシンクアニメーションを停止
function stopLipSync() {
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
    lipSyncInterval = null;
  }

  const mascotMouth = document.getElementById('mascot-mouth');
  if (mascotMouth) {
    mascotMouth.style.display = 'none';
  }
}

// 瞬き用画像を読み込む
function loadBlinkImage(basePath) {
  blinkImagePath = null;

  // 画像パスから拡張子を除去してベース名を取得
  const pathParts = basePath.split('.');
  const extension = pathParts.pop();
  const basePathWithoutExt = pathParts.join('.');

  // _blink.png を設定
  blinkImagePath = `${basePathWithoutExt}_blink.${extension}`;
  console.log(`Loaded blink image: ${blinkImagePath}`);
}

// 瞬きアニメーションを開始
function startBlinkAnimation() {
  if (!blinkImagePath) {
    console.log('No blink image available');
    return;
  }

  const mascotBlink = document.getElementById('mascot-blink');
  if (!mascotBlink) return;

  // ランダムな間隔で瞬きを行う（2〜5秒ごと）
  const scheduleNextBlink = () => {
    const randomInterval = Math.random() * 3000 + 2000; // 2000〜5000ms
    blinkInterval = setTimeout(() => {
      performBlink();
      scheduleNextBlink();
    }, randomInterval);
  };

  // 瞬きを実行
  const performBlink = () => {
    mascotBlink.src = `asset://localhost/${blinkImagePath}`;
    mascotBlink.style.display = 'block';

    // 200msで瞬きを終了
    setTimeout(() => {
      mascotBlink.style.display = 'none';
    }, 200);
  };

  scheduleNextBlink();
}

// 瞬きアニメーションを停止
function stopBlinkAnimation() {
  if (blinkInterval) {
    clearTimeout(blinkInterval);
    blinkInterval = null;
  }

  const mascotBlink = document.getElementById('mascot-blink');
  if (mascotBlink) {
    mascotBlink.style.display = 'none';
  }
}

// 記事切り替え用GIF画像を読み込む
function loadTransitionGif() {
  // 常に image/voidoll.gif を使用
  transitionGifPath = 'image/voidoll.gif';
  console.log(`Loaded transition GIF: ${transitionGifPath}`);
}

// 記事切り替えアニメーションを再生
function playTransitionAnimation(callback) {
  if (!transitionGifPath) {
    console.log('No transition GIF available, skipping animation');
    if (callback) callback();
    return;
  }

  const transitionGif = document.getElementById('transition-gif');
  if (!transitionGif) {
    console.log('transition-gif element not found');
    if (callback) callback();
    return;
  }

  // 元のマスコット画像とデフォルトマスコットを一時的に非表示
  const mascotImage = document.getElementById('mascot-image');
  const defaultMascot = document.getElementById('default-mascot');
  const originalMascotDisplay = mascotImage ? mascotImage.style.display : 'none';
  const originalDefaultDisplay = defaultMascot ? defaultMascot.style.display : 'flex';

  if (mascotImage) mascotImage.style.display = 'none';
  if (defaultMascot) defaultMascot.style.display = 'none';

  // GIFアニメーションを表示
  console.log('Playing transition animation:', transitionGifPath);
  transitionGif.src = transitionGifPath; // 相対パスで直接読み込み
  transitionGif.style.display = 'block';

  // 1秒後にGIFを非表示にして元の画像を復元
  setTimeout(() => {
    transitionGif.style.display = 'none';
    if (mascotImage) mascotImage.style.display = originalMascotDisplay;
    if (defaultMascot) defaultMascot.style.display = originalDefaultDisplay;
    if (callback) callback();
  }, 1000);
}

// ホップアニメーションを開始（アイドル時）
function startHopAnimation() {
  const mascotContainer = document.getElementById('mascot-container');
  if (!mascotContainer) return;

  // 10〜20秒ごとにランダムにホップ
  const scheduleNextHop = () => {
    const randomInterval = Math.random() * 10000 + 10000; // 10000〜20000ms
    hopInterval = setTimeout(() => {
      performHop();
      scheduleNextHop();
    }, randomInterval);
  };

  // ホップアニメーションを実行
  const performHop = () => {
    mascotContainer.style.transition = 'transform 0.3s ease-out';
    mascotContainer.style.transform = 'translateY(-20px)';

    setTimeout(() => {
      mascotContainer.style.transform = 'translateY(0)';
    }, 300);
  };

  scheduleNextHop();
}

// ホップアニメーションを停止
function stopHopAnimation() {
  if (hopInterval) {
    clearTimeout(hopInterval);
    hopInterval = null;
  }

  const mascotContainer = document.getElementById('mascot-container');
  if (mascotContainer) {
    mascotContainer.style.transform = 'translateY(0)';
  }
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

    // 既存のアニメーションを停止
    stopBlinkAnimation();

    // 各種アニメーション用画像を読み込む
    loadMouthImages(imagePath);
    loadBlinkImage(imagePath);
    loadTransitionGif();

    // 瞬きアニメーションを開始
    startBlinkAnimation();
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

// Qiita記事取得機能
async function fetchQiitaArticles(username) {
  try {
    console.log('Fetching Qiita articles for:', username);
    const fetchedArticles = await invoke('fetch_qiita_articles', { username });

    // 記事を追加
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
    console.log(`Loaded ${articles.length} Qiita articles`);
  } catch (error) {
    console.error('Failed to fetch Qiita articles:', error);
    alert(`Qiita記事の取得に失敗しました: ${error}`);
  }
}

// Zenn記事取得機能
async function fetchZennArticles(username) {
  try {
    console.log('Fetching Zenn articles for:', username);
    const fetchedArticles = await invoke('fetch_zenn_articles', { username });

    // 記事を追加
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
    console.log(`Loaded ${articles.length} Zenn articles`);
  } catch (error) {
    console.error('Failed to fetch Zenn articles:', error);
    alert(`Zenn記事の取得に失敗しました: ${error}`);
  }
}

// 天気情報を取得
async function fetchWeather() {
  try {
    console.log('Fetching weather...');
    const weatherData = await invoke('fetch_weather');

    // 気温を取得
    const temp = weatherData.current.temperature_2m;
    const weatherCode = weatherData.current.weathercode;

    // 天気コードを日本語に変換
    const weatherDescriptions = {
      0: '快晴',
      1: '晴れ',
      2: '晴れ',
      3: '曇り',
      45: '霧',
      48: '霧',
      51: '小雨',
      53: '雨',
      55: '大雨',
      61: '小雨',
      63: '雨',
      65: '大雨',
      71: '小雪',
      73: '雪',
      75: '大雪',
      77: '雪',
      80: 'にわか雨',
      81: 'にわか雨',
      82: 'にわか雨',
      85: 'にわか雪',
      86: 'にわか雪',
      95: '雷雨',
      96: '雷雨',
      99: '雷雨'
    };

    const weatherDesc = weatherDescriptions[weatherCode] || '不明';

    // UIを更新
    const tempElement = document.getElementById('weather-temp');
    const descElement = document.getElementById('weather-desc');

    if (tempElement) {
      tempElement.textContent = `${Math.round(temp)}°C`;
    }
    if (descElement) {
      descElement.textContent = `東京: ${weatherDesc}`;
    }

    console.log(`Weather updated: ${temp}°C, ${weatherDesc}`);
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    const descElement = document.getElementById('weather-desc');
    if (descElement) {
      descElement.textContent = '天気情報取得失敗';
    }
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

  // 位置情報をクリア（デバッグ用）
  localStorage.removeItem('mascot-container-position');
  localStorage.removeItem('bubble-container-position');
  localStorage.removeItem('weather-container-position');

  // 保存済みマスコット画像を復元
  restoreMascotImage();

  // トランジションGIFを読み込み
  loadTransitionGif();

  // 保存済みRSSフィードURLまたはデフォルトを取得
  const rssFeedUrl = localStorage.getItem('rssFeedUrl') || 'https://www.nhk.or.jp/rss/news/cat0.xml';
  fetchRSS(rssFeedUrl);

  // 天気情報を取得
  fetchWeather();
  // 30分ごとに天気情報を更新
  setInterval(fetchWeather, 30 * 60 * 1000);

  // ホップアニメーションを開始
  startHopAnimation();

  displayCurrentArticle();
  setupEventListeners();
  setupDraggableAreas();
  restoreElementPositions();
});
