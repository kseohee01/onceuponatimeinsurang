const STORAGE_KEY = 'surang_books_db_v6';
const LEGACY_STORAGE_KEYS = ['surang_books_db_v5', 'surang_books_db_v4', 'surang_books_db_v3'];
const SITE_SETTINGS_KEY = 'surang_site_settings_v1';
const SITE_ASSET_DB_NAME = 'surang_site_assets_v1';
const SITE_ASSET_STORE = 'assets';
const HOMEPAGE_BGM_ASSET_KEY = 'homepage-bgm';
const DEFAULT_BGM_COPYRIGHT = `Music from #Uppbeat (free for Creators!):
https://uppbeat.io/t/vocalista/sweet-lullaby
License code: UFTCIOKHK9ASDJ43`;
const LEGACY_SERVER_STATE_ENDPOINT = '/api/state';
const LEGACY_SERVER_BGM_ENDPOINT = '/api/bgm';
const BOOKS_UPDATED_EVENT = 'surang:books-updated';
const FIREBASE_SDK_VERSION = '12.17.0';
const CLOUD_CONTENT_COLLECTION = 'site';
const CLOUD_CONTENT_DOCUMENT = 'content';
const FIGMA_COVER = 'assets/figma/popup-cover-art.png';
const FIGMA_DETAIL = 'assets/figma/detail-hero.png';
const BUBBLE_REFERENCE_WIDTH = 1600;
const BUBBLE_REFERENCE_HEIGHT = 900;
const BUBBLE_POSITION_SPACE = 'hero-16x9';
const LEGACY_BUBBLE_REFERENCE_WIDTH = 1200;
const LEGACY_BUBBLE_REFERENCE_HEIGHT = 750;
const LEGACY_BUBBLE_POSITION_SPACE = 'hero-8x5';
const MAX_BOOK_IMAGE_SIZE = 15 * 1024 * 1024;
const BOOK_ASSET_FIELDS = ['spineImage', 'coverImage', 'mobileCoverImage', 'detailBgImage'];

const DEFAULT_BUBBLE_STYLE = {
  color: '#2DD4BF',
  opacity: 90
};

const SPINE_HEIGHT_PATTERN = [240, 260, 220, 250, 230, 230, 250, 220, 270, 260, 240, 230, 245, 255];

function getAutomaticSpineHeight(index = 0) {
  const safeIndex = Math.max(0, Math.floor(Number(index) || 0));
  return SPINE_HEIGHT_PATTERN[safeIndex % SPINE_HEIGHT_PATTERN.length];
}

// v4에서 화면 예시를 실제 데이터로 잘못 저장했던 레코드를 식별하기 위한 값입니다.
// v5의 초기 데이터로 사용하지 않습니다.
const FIGMA_EXAMPLE_PRESETS = [
  ['어린왕자', '어린 왕자 : 별에서 온 편지', 'The Little Prince', '#B27171', 240, ['어린 왕자', '여우']],
  ['신비로운 숲', '신비로운 숲 : 사라진 계절', 'The Enchanted Forest', '#2B4335', 260, ['리아', '노아']],
  ['바다의 일기', '바다의 일기 : 파도 너머의 약속', 'The Diary of the Sea', '#3D5A6C', 220, ['마리나', '카이']],
  ['황금 열쇠', '황금 열쇠 : 잠든 문을 열다', 'The Golden Key', '#C98E3A', 250, ['클라라', '테오']],
  ['달빛 아래', '달빛 아래 : 은빛 무도회', 'Under the Moonlight', '#52436D', 230, ['루나', '아리']],
  ['바람의 정원', '바람의 정원 : 흩어진 편지', 'The Garden of Wind', '#2B4335', 230, ['하람', '소이']],
  ['빨간 머리 앤', '빨간 머리 앤 : 초록 지붕 이야기', 'Anne of Green Gables', '#B27171', 250, ['앤', '다이애나']],
  ['모래시계', '모래시계 : 시간을 걷는 아이', 'The Hourglass', '#C98E3A', 220, ['유진', '세라']],
  ['나비의 꿈', '나비의 꿈 : 깨어나는 봄', 'A Butterfly’s Dream', '#5A523D', 270, ['나비', '이안']],
  ['은하철도의 밤', '은하철도의 밤 : 별의 종착역', 'Night on the Galactic Railroad', '#262D42', 260, ['조반니', '캄파넬라']],
  ['피터팬', '피터팬 : 네버랜드의 꿈', 'Peter Pan', '#2B4335', 240, ['피터 팬', '웬디']],
  ['비밀의 화원', '비밀의 화원 : 만개하는 마음', 'The Secret Garden', '#6D4F3D', 230, ['메리', '콜린']],
  ['장화신은 고양이', '장화신은 고양이 : 왕국의 비밀', 'Puss in Boots', '#B27171', 245, ['고양이', '후작']],
  ['백설공주', '백설공주 : 거울 너머의 진실', 'Snow White', '#7D3B51', 255, ['백설', '왕비']]
];

const FIGMA_EXAMPLE_QUOTES = [
  '어쩌면 중요한 건 눈에 보이지 않는 곳에 있을지도 몰라.',
  '우리의 이야기는 아직 끝나지 않았어.',
  '그러니 비밀의 문을 열어 봐.'
];

const LEGACY_TEMP_BOOK_TITLES = new Map([
  ['book-1', '비밀의 화원 : 만개하는 감성'],
  ['book-2', '은하철도의 밤 : 우주 기차여행'],
  ['book-3', '빨간 머리 앤 : 초록지붕 이야기'],
  ['book-4', '피터팬 : 네버랜드의 꿈'],
  ['book-5', '달빛 아래 : 깊은 밤 하늘빛']
]);

let cloudAvailable = false;
let cloudInitialized = false;
let cloudStateUpdatedAt = 0;
let cloudBgm = null;
let cloudUnsubscribe = null;
let cloudServicesPromise = null;
let remoteWriteQueue = Promise.resolve();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = '') {
  return typeof value === 'string' && !value.includes('�') ? value.trim() : fallback;
}

function normalizeBubbleStyle(quote) {
  const source = quote && typeof quote === 'object' ? quote : {};
  const legacyGradient = source.bgGradient && typeof source.bgGradient === 'object'
    ? source.bgGradient
    : {};
  const color = source.bubbleColor || legacyGradient.color1;
  const opacity = source.bubbleOpacity ?? legacyGradient.opacity;
  return {
    color: /^#[0-9a-f]{6}$/i.test(color || '') ? color.toUpperCase() : DEFAULT_BUBBLE_STYLE.color,
    opacity: Math.max(0, Math.min(100, Number(opacity ?? DEFAULT_BUBBLE_STYLE.opacity)))
  };
}

function getBubblePositionReference(positionSpace) {
  if (positionSpace === BUBBLE_POSITION_SPACE) {
    return { width: BUBBLE_REFERENCE_WIDTH, height: BUBBLE_REFERENCE_HEIGHT };
  }
  return { width: LEGACY_BUBBLE_REFERENCE_WIDTH, height: LEGACY_BUBBLE_REFERENCE_HEIGHT };
}

function projectBubblePointToFrame(x, y, positionSpace, imageWidth, imageHeight, frameWidth, frameHeight) {
  const reference = getBubblePositionReference(positionSpace);
  const safeImageWidth = Number(imageWidth) || BUBBLE_REFERENCE_WIDTH;
  const safeImageHeight = Number(imageHeight) || BUBBLE_REFERENCE_HEIGHT;
  const referenceScale = Math.max(reference.width / safeImageWidth, reference.height / safeImageHeight);
  const referenceOffsetX = (reference.width - safeImageWidth * referenceScale) / 2;
  const referenceOffsetY = (reference.height - safeImageHeight * referenceScale) / 2;
  const imageX = (Number(x) - referenceOffsetX) / referenceScale;
  const imageY = (Number(y) - referenceOffsetY) / referenceScale;
  const targetScale = Math.max(frameWidth / safeImageWidth, frameHeight / safeImageHeight);
  const targetOffsetX = (frameWidth - safeImageWidth * targetScale) / 2;
  const targetOffsetY = (frameHeight - safeImageHeight * targetScale) / 2;

  return {
    left: targetOffsetX + imageX * targetScale,
    top: targetOffsetY + imageY * targetScale
  };
}

function framePointToBubbleReference(left, top, imageWidth, imageHeight, frameWidth, frameHeight) {
  const safeImageWidth = Number(imageWidth) || BUBBLE_REFERENCE_WIDTH;
  const safeImageHeight = Number(imageHeight) || BUBBLE_REFERENCE_HEIGHT;
  const frameScale = Math.max(frameWidth / safeImageWidth, frameHeight / safeImageHeight);
  const frameOffsetX = (frameWidth - safeImageWidth * frameScale) / 2;
  const frameOffsetY = (frameHeight - safeImageHeight * frameScale) / 2;
  const imageX = (Number(left) - frameOffsetX) / frameScale;
  const imageY = (Number(top) - frameOffsetY) / frameScale;
  const referenceScale = Math.max(
    BUBBLE_REFERENCE_WIDTH / safeImageWidth,
    BUBBLE_REFERENCE_HEIGHT / safeImageHeight
  );
  const referenceOffsetX = (BUBBLE_REFERENCE_WIDTH - safeImageWidth * referenceScale) / 2;
  const referenceOffsetY = (BUBBLE_REFERENCE_HEIGHT - safeImageHeight * referenceScale) / 2;

  return {
    x: referenceOffsetX + imageX * referenceScale,
    y: referenceOffsetY + imageY * referenceScale
  };
}

function normalizeQuote(quote, index) {
  const source = quote || {};
  const hasPosition = Number.isFinite(Number(source.x)) && Number.isFinite(Number(source.y));
  const usesLegacyHeroSpace = source.positionSpace === 'hero' || source.positionSpace === LEGACY_BUBBLE_POSITION_SPACE;
  const usesCanonicalHeroSpace = source.positionSpace === BUBBLE_POSITION_SPACE || !hasPosition;
  const fallbackPositions = [
    [768, 72],
    [704, 288],
    [1072, 315]
  ];
  const fallback = fallbackPositions[index % fallbackPositions.length];
  const rawX = hasPosition ? Number(source.x) : fallback[0];
  const rawY = hasPosition ? Number(source.y) : fallback[1];
  const positionSpace = usesCanonicalHeroSpace ? BUBBLE_POSITION_SPACE : LEGACY_BUBBLE_POSITION_SPACE;
  const reference = getBubblePositionReference(positionSpace);
  const normalizedX = usesLegacyHeroSpace || usesCanonicalHeroSpace ? rawX : rawX - 120;
  const normalizedY = usesLegacyHeroSpace || usesCanonicalHeroSpace ? rawY : rawY - 75;
  const bubbleStyle = normalizeBubbleStyle(source);

  return {
    id: cleanText(source.id) || `quote-${Date.now()}-${index}`,
    text: cleanText(source.text, '새로운 대사를 입력하세요.'),
    tail: ['L', 'C', 'R'].includes(source.tail) ? source.tail : 'C',
    x: Math.max(0, Math.min(reference.width, normalizedX)),
    y: Math.max(0, Math.min(reference.height, normalizedY)),
    positionSpace,
    bubbleColor: bubbleStyle.color,
    bubbleOpacity: bubbleStyle.opacity
  };
}

function normalizeBook(book, index = 0) {
  const source = book && typeof book === 'object' ? book : {};
  const title = cleanText(source.title, '제목 없는 이야기');
  const sourceSpineHeight = Number(source.spineHeight);
  const sourceSpineWidth = Number(source.spineWidth);
  const shouldApplyHeightPattern =
    !Number.isFinite(sourceSpineHeight) ||
    (source.spineHeightPatternVersion === undefined && sourceSpineHeight === 230);
  const characters = Array.isArray(source.participatingCharacters)
    ? source.participatingCharacters.map((item) => cleanText(item)).filter(Boolean)
    : [];
  const quotes = Array.isArray(source.quotes)
    ? source.quotes.slice(0, 8).map(normalizeQuote)
    : [];
  const now = new Date().toISOString();

  return {
    id: cleanText(source.id) || `book-${Date.now()}-${index}`,
    shelfOrder: Number.isFinite(Number(source.shelfOrder)) ? Number(source.shelfOrder) : index,
    title,
    // 책등에는 별도의 사용자 입력값 대신 책 제목을 그대로 사용합니다.
    spineTitle: title,
    subtitle: cleanText(source.subtitle),
    concept: cleanText(source.concept, '미분류'),
    description: cleanText(source.description),
    participatingCharacters: characters,
    contact: cleanText(source.contact),
    status: source.status === 'active' ? 'active' : 'draft',
    spineColor: /^#[0-9a-f]{6}$/i.test(source.spineColor || '')
      ? source.spineColor.toUpperCase()
      : '#6D4F3D',
    spineHeight: shouldApplyHeightPattern
      ? getAutomaticSpineHeight(index)
      : Math.max(120, Math.min(270, sourceSpineHeight)),
    spineHeightPatternVersion: 1,
    spineWidth: Number.isFinite(sourceSpineWidth)
      ? Math.max(30, Math.min(120, sourceSpineWidth))
      : 60,
    spineImage: typeof source.spineImage === 'string' ? source.spineImage : '',
    coverImage: typeof source.coverImage === 'string' ? source.coverImage : '',
    mobileCoverImage: typeof source.mobileCoverImage === 'string' ? source.mobileCoverImage : '',
    detailBgImage: typeof source.detailBgImage === 'string' ? source.detailBgImage : '',
    quotes,
    createdAt: cleanText(source.createdAt, now),
    updatedAt: cleanText(source.updatedAt, now)
  };
}

function arraysEqual(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function isUnchangedFigmaExample(book) {
  const match = /^book-(\d+)$/.exec(String(book?.id || ''));
  if (!match) return false;
  const exampleIndex = Number(match[1]) - 1;
  const preset = FIGMA_EXAMPLE_PRESETS[exampleIndex];
  if (!preset) return false;

  const [, title, subtitle, spineColor, spineHeight, characters] = preset;
  const expectedConcept = exampleIndex % 3 === 0
    ? '세계 명작'
    : exampleIndex % 3 === 1
      ? '환상 동화'
      : '감성 소설';
  const quotes = Array.isArray(book.quotes) ? book.quotes : [];
  const quoteTextsMatch = quotes.length === 3 &&
    quotes.every((quote, index) => quote.text === FIGMA_EXAMPLE_QUOTES[index]);
  const quotePositionsMatch = quotes.length === 3 && quotes.every((quote, index) => {
    const pagePositions = [[694, 121], [645, 294], [929, 316]];
    const heroPositions = [[574, 46], [525, 219], [809, 241]];
    return (
      (Number(quote.x) === pagePositions[index][0] && Number(quote.y) === pagePositions[index][1]) ||
      (Number(quote.x) === heroPositions[index][0] && Number(quote.y) === heroPositions[index][1])
    );
  });
  const quoteStylesMatch = quotes.length === 3 && quotes.every((quote, index) => {
    const gradient = quote.bgGradient || {};
    const bubbleColor = String(quote.bubbleColor || gradient.color1 || '').toUpperCase();
    const bubbleOpacity = Number(quote.bubbleOpacity ?? gradient.opacity);
    const isOriginalBrown =
      String(gradient.color1).toUpperCase() === '#664D3F' &&
      String(gradient.color2).toUpperCase() === '#1B100A';
    const isFigmaTeal =
      String(gradient.color1).toUpperCase() === '#2DD4BF' &&
      String(gradient.color2).toUpperCase() === '#0F766E';
    return (
      quote.tail === ['R', 'C', 'L'][index] &&
      (isOriginalBrown || isFigmaTeal || bubbleColor === '#664D3F' || bubbleColor === '#2DD4BF') &&
      (!quote.bgGradient || gradient.direction === '135deg') &&
      bubbleOpacity === 90
    );
  });

  return (
    book.title === title &&
    book.subtitle === subtitle &&
    book.concept === expectedConcept &&
    book.description === '서로 다른 이야기 속 인물들이 수랑고에서 만나 완성하는 단 하나의 동화입니다.' &&
    arraysEqual(book.participatingCharacters, characters) &&
    book.contact === 'surang@example.com' &&
    book.status === 'active' &&
    String(book.spineColor).toUpperCase() === spineColor &&
    Number(book.spineHeight) === spineHeight &&
    !book.spineImage &&
    book.coverImage === FIGMA_COVER &&
    book.detailBgImage === FIGMA_DETAIL &&
    quoteTextsMatch &&
    quotePositionsMatch &&
    quoteStylesMatch
  );
}

function isLegacyTemporaryBook(book) {
  const expectedTitle = LEGACY_TEMP_BOOK_TITLES.get(String(book?.id || ''));
  return Boolean(expectedTitle && book?.title === expectedTitle);
}

function readStoredArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`${key} 데이터를 읽지 못했습니다.`, error);
    return [];
  }
}

async function requestLegacyServerJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const message = await response.json().catch(() => ({}));
    throw new Error(message.error || `기존 서버 요청 실패 (${response.status})`);
  }
  return response.json();
}

function localBooksForServerSeed() {
  if (localStorage.getItem(STORAGE_KEY) !== null) {
    return readStoredArray(STORAGE_KEY)
      .filter((book) => !isLegacyTemporaryBook(book) && !isUnchangedFigmaExample(book))
      .map(normalizeBook);
  }
  return migrateBooks();
}

async function getCloudServices() {
  if (cloudServicesPromise) return cloudServicesPromise;

  cloudServicesPromise = Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-storage.js`)
  ]).then(([firebaseApp, firestore, storage]) => {
    const config = window.SURANG_FIREBASE_CONFIG;
    const databaseId = window.SURANG_FIREBASE_DATABASE_ID || 'surang';
    if (!config?.projectId) throw new Error('Firebase 프로젝트 설정이 없습니다.');

    const app = firebaseApp.getApps().length
      ? firebaseApp.getApp()
      : firebaseApp.initializeApp(config);

    return {
      app,
      firestore,
      storage,
      database: firestore.getFirestore(app, databaseId),
      bucket: storage.getStorage(app)
    };
  });

  return cloudServicesPromise;
}

function cloudContentReference(services) {
  return services.firestore.doc(
    services.database,
    CLOUD_CONTENT_COLLECTION,
    CLOUD_CONTENT_DOCUMENT
  );
}

function toCloudState(data) {
  return {
    version: Number(data?.version) || 1,
    initialized: Boolean(data?.initialized),
    books: Array.isArray(data?.books) ? data.books : [],
    bgm: data?.bgm && typeof data.bgm === 'object' ? data.bgm : null,
    updatedAt: Number(data?.updatedAt) || 0
  };
}

function applyCloudState(state, notify = true) {
  cloudAvailable = true;
  cloudInitialized = Boolean(state?.initialized);
  cloudStateUpdatedAt = Number(state?.updatedAt) || 0;
  cloudBgm = state?.bgm && typeof state.bgm === 'object' ? state.bgm : null;

  if (!cloudInitialized) return;

  const normalizedBooks = (Array.isArray(state.books) ? state.books : [])
    .map(normalizeBook)
    .sort((left, right) => left.shelfOrder - right.shelfOrder);
  const previousBooks = localStorage.getItem(STORAGE_KEY) || '[]';
  const nextBooks = JSON.stringify(normalizedBooks);
  localStorage.setItem(STORAGE_KEY, nextBooks);

  const currentSettings = getSiteSettings();
  const nextSettings = {
    bgmName: cloudBgm?.name || '',
    bgmUpdatedAt: Number(cloudBgm?.updatedAt) || 0,
    bgmCopyright: DEFAULT_BGM_COPYRIGHT
  };
  localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(nextSettings));

  if (notify && previousBooks !== nextBooks) {
    window.dispatchEvent(new CustomEvent(BOOKS_UPDATED_EVENT, { detail: normalizedBooks }));
  }
  if (
    notify &&
    (
      currentSettings.bgmName !== nextSettings.bgmName ||
      currentSettings.bgmUpdatedAt !== nextSettings.bgmUpdatedAt
    )
  ) {
    window.dispatchEvent(new CustomEvent('surang:site-settings', { detail: nextSettings }));
  }
}

function isDataUrl(value) {
  return typeof value === 'string' && /^data:[^;,]+(?:;[^,]*)?,/i.test(value);
}

function dataUrlContentType(value, fallback = 'application/octet-stream') {
  return /^data:([^;,]+)/i.exec(value || '')?.[1] || fallback;
}

function isBlob(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function bookAssetContentType(value) {
  if (isBlob(value) && value.type) return value.type;
  return dataUrlContentType(value, 'image/png');
}

function createBookAssetPath(book, fieldName) {
  const version = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `books/${book.id}/${fieldName}-${version}`;
}

async function uploadBookAsset(services, book, fieldName) {
  const value = book[fieldName];
  if (!isBlob(value) && !isDataUrl(value)) return value || '';
  if (isBlob(value) && value.size > MAX_BOOK_IMAGE_SIZE) {
    throw new Error(`${fieldName} 이미지가 15MB 제한을 초과했습니다.`);
  }

  const assetReference = services.storage.ref(
    services.bucket,
    createBookAssetPath(book, fieldName)
  );
  const metadata = {
    contentType: bookAssetContentType(value),
    cacheControl: 'public,max-age=31536000,immutable'
  };
  const snapshot = isBlob(value)
    ? await services.storage.uploadBytes(assetReference, value, metadata)
    : await services.storage.uploadString(assetReference, value, 'data_url', metadata);
  return services.storage.getDownloadURL(snapshot.ref);
}

async function uploadBookAssets(services, book) {
  const [spineImage, coverImage, mobileCoverImage, detailBgImage] = await Promise.all([
    uploadBookAsset(services, book, 'spineImage'),
    uploadBookAsset(services, book, 'coverImage'),
    uploadBookAsset(services, book, 'mobileCoverImage'),
    uploadBookAsset(services, book, 'detailBgImage')
  ]);
  return normalizeBook({ ...book, spineImage, coverImage, mobileCoverImage, detailBgImage }, book.shelfOrder);
}

async function uploadCloudBgm(services, file, fileName = file?.name || 'homepage-bgm.mp3') {
  const contentType = file?.type || 'audio/mpeg';
  const assetReference = services.storage.ref(services.bucket, 'site/bgm/homepage.mp3');
  const snapshot = await services.storage.uploadBytes(assetReference, file, {
    contentType,
    cacheControl: 'public,max-age=3600'
  });
  return {
    name: fileName,
    type: contentType,
    size: Number(file?.size) || 0,
    path: snapshot.ref.fullPath,
    url: await services.storage.getDownloadURL(snapshot.ref),
    updatedAt: Date.now()
  };
}

async function readLegacySeed() {
  let books = localBooksForServerSeed();
  let bgmFile = null;
  let bgmName = '';

  try {
    bgmFile = await readSiteAsset(HOMEPAGE_BGM_ASSET_KEY);
    bgmName = getSiteSettings().bgmName || bgmFile?.name || '';
  } catch (error) {
    console.warn('기존 브라우저 BGM을 읽지 못했습니다.', error);
  }

  try {
    const state = await requestLegacyServerJson(LEGACY_SERVER_STATE_ENDPOINT);
    if (state.initialized) {
      if (Array.isArray(state.books)) books = state.books;
      if (state.bgm) {
        const response = await fetch(LEGACY_SERVER_BGM_ENDPOINT, { cache: 'no-store' });
        if (response.ok) {
          bgmFile = await response.blob();
          bgmName = state.bgm.name || 'homepage-bgm.mp3';
        }
      }
    }
  } catch (error) {
    // GitHub Pages에는 기존 Node API가 없으므로 브라우저 데이터만 사용합니다.
  }

  return { books, bgmFile, bgmName };
}

function startCloudSubscription(services) {
  if (cloudUnsubscribe) return;
  cloudUnsubscribe = services.firestore.onSnapshot(
    cloudContentReference(services),
    (snapshot) => {
      if (!snapshot.exists()) {
        cloudInitialized = false;
        return;
      }
      const nextState = toCloudState(snapshot.data());
      if (nextState.updatedAt !== cloudStateUpdatedAt || nextState.initialized !== cloudInitialized) {
        applyCloudState(nextState, true);
      }
    },
    (error) => {
      console.warn('Firestore 실시간 동기화가 중단되었습니다.', error);
      window.dispatchEvent(new CustomEvent('surang:data-sync-error', { detail: error }));
    }
  );
}

async function initializeSurangData({ allowLocalSeed = false } = {}) {
  try {
    const services = await getCloudServices();
    const snapshot = await services.firestore.getDoc(cloudContentReference(services));
    cloudAvailable = true;

    if (snapshot.exists()) {
      const state = toCloudState(snapshot.data());
      applyCloudState(state, false);
      startCloudSubscription(services);
      return { source: 'firestore', initialized: true };
    }

    if (!allowLocalSeed) {
      cloudInitialized = false;
      cloudBgm = null;
      startCloudSubscription(services);
      return { source: 'firestore', initialized: false };
    }

    const legacy = await readLegacySeed();
    const books = await Promise.all(
      legacy.books.map(normalizeBook).map((book) => uploadBookAssets(services, book))
    );
    const bgm = legacy.bgmFile
      ? await uploadCloudBgm(services, legacy.bgmFile, legacy.bgmName)
      : null;
    const initializedState = {
      version: 1,
      initialized: true,
      books,
      bgm,
      updatedAt: Date.now()
    };
    await services.firestore.setDoc(cloudContentReference(services), initializedState);
    applyCloudState(initializedState, false);
    startCloudSubscription(services);
    return { source: 'firestore', initialized: true, migrated: true };
  } catch (error) {
    cloudAvailable = false;
    cloudInitialized = false;
    console.warn('Firestore에 연결하지 못해 브라우저 저장소를 사용합니다.', error);
    return { source: 'browser', initialized: true, error };
  }
}

function queueCloudBooksWrite(books) {
  if (!cloudAvailable || !cloudInitialized) return Promise.resolve(null);
  const writeTask = remoteWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const services = await getCloudServices();
      const uploadedBooks = await Promise.all(
        books.map((book) => uploadBookAssets(services, book))
      );
      const state = {
        version: 1,
        initialized: true,
        books: uploadedBooks,
        bgm: cloudBgm,
        updatedAt: Date.now()
      };
      await services.firestore.setDoc(cloudContentReference(services), state);
      applyCloudState(state, true);
      return state;
    });
  remoteWriteQueue = writeTask.catch((error) => {
      console.error('관리자 책 데이터를 Firestore에 저장하지 못했습니다.', error);
      window.dispatchEvent(new CustomEvent('surang:data-sync-error', { detail: error }));
    });
  return writeTask;
}

function migrateBooks() {
  for (const key of LEGACY_STORAGE_KEYS) {
    if (localStorage.getItem(key) === null) continue;
    const legacyBooks = readStoredArray(key);
    const migrated = legacyBooks.filter((book) => (
      !isLegacyTemporaryBook(book) && !isUnchangedFigmaExample(book)
    ));
    const normalized = migrated.map(normalizeBook);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  localStorage.setItem(STORAGE_KEY, '[]');
  return [];
}

function getBooks() {
  if (cloudAvailable && !cloudInitialized) return [];
  if (localStorage.getItem(STORAGE_KEY) === null) return migrateBooks();
  return readStoredArray(STORAGE_KEY)
    .map(normalizeBook)
    .sort((left, right) => left.shelfOrder - right.shelfOrder);
}

function saveBooks(books) {
  const normalized = books
    .map(normalizeBook)
    .sort((left, right) => left.shelfOrder - right.shelfOrder);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(BOOKS_UPDATED_EVENT, { detail: normalized }));
  void queueCloudBooksWrite(normalized);
  return normalized;
}

async function deleteCloudAssetUrls(services, urls) {
  const targets = [...new Set(urls.filter((value) => /^https:\/\//i.test(value || '')))];
  await Promise.all(targets.map(async (url) => {
    try {
      await services.storage.deleteObject(services.storage.ref(services.bucket, url));
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') throw error;
    }
  }));
}

async function saveBookWithAssets(book) {
  const books = getBooks();
  const existingIndex = book?.id
    ? books.findIndex((item) => item.id === book.id)
    : -1;
  const existing = existingIndex >= 0 ? books[existingIndex] : null;
  const now = new Date().toISOString();
  const nextOrder = books.reduce((highest, item) => Math.max(highest, item.shelfOrder), -1) + 1;
  const id = existing?.id || `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const source = {
    ...(existing || {}),
    ...(book || {}),
    id,
    spineTitle: cleanText(book?.title, existing?.title || '제목 없는 이야기'),
    shelfOrder: existing?.shelfOrder ?? nextOrder,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const replacedFields = BOOK_ASSET_FIELDS.filter((fieldName) => (
    isBlob(source[fieldName]) || isDataUrl(source[fieldName])
  ));
  const previousAssetUrls = replacedFields.map((fieldName) => existing?.[fieldName]).filter(Boolean);
  let services = null;
  let preparedBook = source;

  if (replacedFields.length) {
    if (!cloudAvailable || !cloudInitialized) {
      throw new Error('클라우드에 연결되지 않아 이미지를 저장할 수 없습니다.');
    }
    services = await getCloudServices();
    preparedBook = await uploadBookAssets(services, source);
  }

  const normalizedBook = normalizeBook(preparedBook, existingIndex >= 0 ? existingIndex : books.length);
  const nextBooks = existingIndex >= 0
    ? books.map((item, index) => (index === existingIndex ? normalizedBook : item))
    : [...books, normalizedBook];
  const normalizedBooks = nextBooks
    .map(normalizeBook)
    .sort((left, right) => left.shelfOrder - right.shelfOrder);

  // Base64나 File 객체는 브라우저 저장소에 넣지 않고, 업로드가 끝난 URL만 보관합니다.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedBooks));
  window.dispatchEvent(new CustomEvent(BOOKS_UPDATED_EVENT, { detail: normalizedBooks }));
  await queueCloudBooksWrite(normalizedBooks);

  if (services && previousAssetUrls.length) {
    try {
      await deleteCloudAssetUrls(services, previousAssetUrls);
    } catch (error) {
      console.warn('교체한 이전 책 이미지를 정리하지 못했습니다.', error);
    }
  }

  return normalizedBooks.find((item) => item.id === id) || normalizedBook;
}

function getBookById(id) {
  return getBooks().find((book) => book.id === id) || null;
}

function addBook(book) {
  const books = getBooks();
  const now = new Date().toISOString();
  const nextOrder = books.reduce((highest, item) => Math.max(highest, item.shelfOrder), -1) + 1;
  const created = normalizeBook({
    ...book,
    id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    shelfOrder: nextOrder,
    createdAt: now,
    updatedAt: now
  }, books.length);
  books.push(created);
  saveBooks(books);
  return created;
}

function updateBook(updatedBook) {
  const books = getBooks();
  const index = books.findIndex((book) => book.id === updatedBook.id);
  if (index === -1) return null;

  books[index] = normalizeBook({
    ...books[index],
    ...updatedBook,
    id: books[index].id,
    createdAt: books[index].createdAt,
    updatedAt: new Date().toISOString()
  }, index);
  saveBooks(books);
  return books[index];
}

function reorderBooks(orderedIds) {
  const books = getBooks();
  const booksById = new Map(books.map((book) => [book.id, book]));
  const orderedBooks = [];
  const includedIds = new Set();

  (Array.isArray(orderedIds) ? orderedIds : []).forEach((id) => {
    const book = booksById.get(id);
    if (!book || includedIds.has(id)) return;
    includedIds.add(id);
    orderedBooks.push(book);
  });

  books.forEach((book) => {
    if (includedIds.has(book.id)) return;
    orderedBooks.push(book);
  });

  return saveBooks(orderedBooks.map((book, index) => ({
    ...book,
    shelfOrder: index
  })));
}

function deleteBook(id) {
  const currentBooks = getBooks();
  const removedBook = currentBooks.find((book) => book.id === id);
  const books = currentBooks
    .filter((book) => book.id !== id)
    .map((book, index) => ({ ...book, shelfOrder: index }));
  const saved = saveBooks(books);
  if (removedBook) queueCloudBookAssetDelete(removedBook);
  return saved;
}

function queueCloudBookAssetDelete(book) {
  if (!cloudAvailable || !cloudInitialized) return;
  remoteWriteQueue = remoteWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const services = await getCloudServices();
      const urls = [book.spineImage, book.coverImage, book.mobileCoverImage, book.detailBgImage]
        .filter((value) => /^https:\/\//i.test(value || ''));
      await deleteCloudAssetUrls(services, urls);
    })
    .catch((error) => {
      console.warn('삭제한 책의 Storage 에셋을 정리하지 못했습니다.', error);
    });
}

function subscribeBooks(listener) {
  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) listener(getBooks());
  };
  const handleLocalUpdate = (event) => listener(event.detail || getBooks());
  window.addEventListener('storage', handleStorage);
  window.addEventListener(BOOKS_UPDATED_EVENT, handleLocalUpdate);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(BOOKS_UPDATED_EVENT, handleLocalUpdate);
  };
}

function getSiteSettings() {
  const fallback = {
    bgmName: '',
    bgmUpdatedAt: 0,
    bgmCopyright: DEFAULT_BGM_COPYRIGHT
  };
  try {
    const stored = JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || '{}');
    return {
      bgmName: cleanText(stored.bgmName),
      bgmUpdatedAt: Number(stored.bgmUpdatedAt) || 0,
      bgmCopyright: DEFAULT_BGM_COPYRIGHT
    };
  } catch (error) {
    console.warn('홈페이지 설정을 읽지 못했습니다.', error);
    return fallback;
  }
}

function writeSiteSettings(settings) {
  const current = getSiteSettings();
  const next = {
    ...current,
    ...settings
  };
  next.bgmCopyright = DEFAULT_BGM_COPYRIGHT;
  next.bgmUpdatedAt = Object.prototype.hasOwnProperty.call(settings, 'bgmName')
    ? Date.now()
    : current.bgmUpdatedAt;
  localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('surang:site-settings', { detail: next }));
  return next;
}

function openSiteAssetDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SITE_ASSET_DB_NAME, 1);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SITE_ASSET_STORE)) {
        database.createObjectStore(SITE_ASSET_STORE);
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}

async function readSiteAsset(key) {
  const database = await openSiteAssetDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SITE_ASSET_STORE, 'readonly');
    const request = transaction.objectStore(SITE_ASSET_STORE).get(key);
    request.addEventListener('success', () => resolve(request.result || null));
    request.addEventListener('error', () => reject(request.error));
    transaction.addEventListener('complete', () => database.close());
  });
}

async function writeSiteAsset(key, value) {
  const database = await openSiteAssetDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SITE_ASSET_STORE, 'readwrite');
    transaction.objectStore(SITE_ASSET_STORE).put(value, key);
    transaction.addEventListener('complete', () => {
      database.close();
      resolve(value);
    });
    transaction.addEventListener('error', () => reject(transaction.error));
  });
}

async function deleteSiteAsset(key) {
  const database = await openSiteAssetDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SITE_ASSET_STORE, 'readwrite');
    transaction.objectStore(SITE_ASSET_STORE).delete(key);
    transaction.addEventListener('complete', () => {
      database.close();
      resolve();
    });
    transaction.addEventListener('error', () => reject(transaction.error));
  });
}

async function saveHomepageBgm(file) {
  await writeSiteAsset(HOMEPAGE_BGM_ASSET_KEY, file);
  if (cloudAvailable && cloudInitialized) {
    const services = await getCloudServices();
    const bgm = await uploadCloudBgm(services, file, file.name);
    await services.firestore.setDoc(cloudContentReference(services), {
      version: 1,
      initialized: true,
      bgm,
      updatedAt: Date.now()
    }, { merge: true });
    cloudBgm = bgm;
  }
  return writeSiteSettings({ bgmName: file.name });
}

async function getHomepageBgm({ stream = false } = {}) {
  if (cloudAvailable && cloudInitialized) {
    if (!cloudBgm?.url) {
      return {
        bgmName: '',
        bgmUpdatedAt: 0,
        bgmCopyright: DEFAULT_BGM_COPYRIGHT,
        blob: null
      };
    }
    const metadata = {
      bgmName: cloudBgm.name || '',
      bgmUpdatedAt: Number(cloudBgm.updatedAt) || 0,
      bgmCopyright: DEFAULT_BGM_COPYRIGHT
    };
    if (stream) return { ...metadata, url: cloudBgm.url, blob: null };

    const response = await fetch(cloudBgm.url);
    if (!response.ok) throw new Error(`BGM 파일 요청 실패 (${response.status})`);
    return {
      ...metadata,
      blob: await response.blob()
    };
  }
  const settings = getSiteSettings();
  const blob = await readSiteAsset(HOMEPAGE_BGM_ASSET_KEY);
  return { ...settings, blob };
}

async function deleteHomepageBgm() {
  await deleteSiteAsset(HOMEPAGE_BGM_ASSET_KEY);
  if (cloudAvailable && cloudInitialized) {
    const services = await getCloudServices();
    const path = cloudBgm?.path || 'site/bgm/homepage.mp3';
    try {
      await services.storage.deleteObject(services.storage.ref(services.bucket, path));
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') throw error;
    }
    await services.firestore.setDoc(cloudContentReference(services), {
      version: 1,
      initialized: true,
      bgm: null,
      updatedAt: Date.now()
    }, { merge: true });
    cloudBgm = null;
  }
  return writeSiteSettings({ bgmName: '' });
}

function subscribeSiteSettings(listener) {
  const handleStorage = (event) => {
    if (event.key === SITE_SETTINGS_KEY) listener(getSiteSettings());
  };
  const handleLocalUpdate = (event) => listener(event.detail || getSiteSettings());
  window.addEventListener('storage', handleStorage);
  window.addEventListener('surang:site-settings', handleLocalUpdate);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('surang:site-settings', handleLocalUpdate);
  };
}
