const STORAGE_KEY = 'surang_books_db_v5';
const LEGACY_STORAGE_KEYS = ['surang_books_db_v4', 'surang_books_db_v3'];
const FIGMA_COVER = 'assets/figma/popup-cover-art.png';
const FIGMA_DETAIL = 'assets/figma/detail-hero.png';

const DEFAULT_GRADIENT = {
  color1: '#2DD4BF',
  color2: '#0F766E',
  direction: '135deg',
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = '') {
  return typeof value === 'string' && !value.includes('�') ? value.trim() : fallback;
}

function normalizeGradient(gradient) {
  const source = gradient && typeof gradient === 'object' ? gradient : {};
  return {
    color1: /^#[0-9a-f]{6}$/i.test(source.color1 || '') ? source.color1.toUpperCase() : DEFAULT_GRADIENT.color1,
    color2: /^#[0-9a-f]{6}$/i.test(source.color2 || '') ? source.color2.toUpperCase() : DEFAULT_GRADIENT.color2,
    direction: ['45deg', '90deg', '135deg', '180deg'].includes(source.direction)
      ? source.direction
      : DEFAULT_GRADIENT.direction,
    opacity: Math.max(0, Math.min(100, Number(source.opacity ?? DEFAULT_GRADIENT.opacity)))
  };
}

function normalizeQuote(quote, index) {
  const source = quote || {};
  const hasPosition = Number.isFinite(Number(source.x)) && Number.isFinite(Number(source.y));
  const usesHeroSpace = source.positionSpace === 'hero' || !hasPosition;
  const fallbackPositions = [
    [574, 46],
    [525, 219],
    [809, 241]
  ];
  const fallback = fallbackPositions[index % fallbackPositions.length];
  const rawX = hasPosition ? Number(source.x) : fallback[0];
  const rawY = hasPosition ? Number(source.y) : fallback[1];

  return {
    id: cleanText(source.id) || `quote-${Date.now()}-${index}`,
    text: cleanText(source.text, '새로운 대사를 입력하세요.'),
    tail: ['L', 'C', 'R'].includes(source.tail) ? source.tail : 'C',
    x: Math.max(0, Math.min(1200, usesHeroSpace ? rawX : rawX - 120)),
    y: Math.max(0, Math.min(750, usesHeroSpace ? rawY : rawY - 75)),
    positionSpace: 'hero',
    bgGradient: normalizeGradient(source.bgGradient)
  };
}

function normalizeBook(book, index = 0) {
  const source = book && typeof book === 'object' ? book : {};
  const title = cleanText(source.title, '제목 없는 이야기');
  const sourceSpineHeight = Number(source.spineHeight);
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
    spineTitle: cleanText(source.spineTitle, title),
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
      : Math.max(190, Math.min(270, sourceSpineHeight)),
    spineHeightPatternVersion: 1,
    spineImage: typeof source.spineImage === 'string' ? source.spineImage : '',
    coverImage: typeof source.coverImage === 'string' ? source.coverImage : '',
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

  const [spineTitle, title, subtitle, spineColor, spineHeight, characters] = preset;
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
    const isOriginalBrown =
      String(gradient.color1).toUpperCase() === '#664D3F' &&
      String(gradient.color2).toUpperCase() === '#1B100A';
    const isFigmaTeal =
      String(gradient.color1).toUpperCase() === '#2DD4BF' &&
      String(gradient.color2).toUpperCase() === '#0F766E';
    return (
      quote.tail === ['R', 'C', 'L'][index] &&
      (isOriginalBrown || isFigmaTeal) &&
      gradient.direction === '135deg' &&
      Number(gradient.opacity) === 90
    );
  });

  return (
    book.title === title &&
    book.spineTitle === spineTitle &&
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

function readStoredArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`${key} 데이터를 읽지 못했습니다.`, error);
    return [];
  }
}

function migrateBooks() {
  for (const key of LEGACY_STORAGE_KEYS) {
    if (localStorage.getItem(key) === null) continue;
    const legacyBooks = readStoredArray(key);
    const migrated = key === 'surang_books_db_v4'
      ? legacyBooks.filter((book) => !isUnchangedFigmaExample(book))
      : legacyBooks;
    const normalized = migrated.map(normalizeBook);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  localStorage.setItem(STORAGE_KEY, '[]');
  return [];
}

function getBooks() {
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
  return normalized;
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

function deleteBook(id) {
  const books = getBooks()
    .filter((book) => book.id !== id)
    .map((book, index) => ({ ...book, shelfOrder: index }));
  return saveBooks(books);
}

function subscribeBooks(listener) {
  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) listener(getBooks());
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
