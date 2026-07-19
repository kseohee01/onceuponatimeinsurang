// Shared Database Layer using localStorage
const STORAGE_KEY = 'surang_books_db_v3';

const DEFAULT_BOOKS = [
  {
    id: 'book-1',
    title: '비밀의 화원 : 만개하는 감성',
    subtitle: 'The Secret Garden',
    concept: '세계 명작',
    spineTitle: '신비로운 숲',
    spineHeight: 260,
    spineColor: '#2B4335',
    participatingCharacters: ['마리', '콜린', '디콘'],
    contact: '010-1234-5678',
    status: 'active',
    spineImage: '',
    coverImage: 'assets/images/popup-cover-image.png',
    detailBgImage: 'assets/images/hero-banner-image.png',
    quotes: [
      { 
        id: 'q-1-1', 
        text: '정원 깊숙한 곳에서, 나만의 꽃이 피어나...', 
        tail: 'L', 
        x: 684, 
        y: 121,
        bgGradient: { color1: '#2DD4BF', color2: '#0F766E', direction: '135deg', opacity: 90 }
      },
      { 
        id: 'q-1-2', 
        text: '이 정원의 열쇠는 내 마음에 있었던 거야.', 
        tail: 'C', 
        x: 268, 
        y: 269,
        bgGradient: { color1: '#C084FC', color2: '#7E22CE', direction: '135deg', opacity: 80 }
      },
      { 
        id: 'q-1-3', 
        text: '누구에게도 말하지 마, 비밀의 문이...', 
        tail: 'R', 
        x: 929, 
        y: 316,
        bgGradient: { color1: '#E879F9', color2: '#C084FC', direction: '135deg', opacity: 85 }
      },
      { 
        id: 'q-1-4', 
        text: '이곳이 우리의 숨겨진 낙원이야.', 
        tail: 'C', 
        x: 645, 
        y: 294,
        bgGradient: { color1: '#F472B6', color2: '#DB2777', direction: '135deg', opacity: 90 }
      }
    ]
  },
  {
    id: 'book-2',
    title: '은하철도의 밤 : 우주 기차여행',
    subtitle: 'Night on the Milky Way Railway',
    concept: '환상 동화',
    spineTitle: '황금 열쇠',
    spineHeight: 250,
    spineColor: '#C98E3A',
    participatingCharacters: ['조반니', '캄파넬라'],
    contact: '010-9876-5432',
    status: 'active',
    spineImage: '',
    coverImage: 'assets/images/popup-cover-image.png',
    detailBgImage: 'assets/images/hero-banner-image.png',
    quotes: [
      { 
        id: 'q-2-1', 
        text: '우린 영원히 함께 기차를 타자.', 
        tail: 'C', 
        x: 580, 
        y: 220,
        bgGradient: { color1: '#1E3A8A', color2: '#0D1B2A', direction: '180deg', opacity: 80 }
      }
    ]
  },
  {
    id: 'book-3',
    title: '빨간 머리 앤 : 초록지붕 이야기',
    subtitle: 'Anne of Green Gables',
    concept: '감성 소설',
    spineTitle: '어린왕자',
    spineHeight: 240,
    spineColor: '#B27171',
    participatingCharacters: ['앤', '다이애나', '길버트'],
    contact: '010-5555-5555',
    status: 'active',
    spineImage: '',
    coverImage: 'assets/images/popup-cover-image.png',
    detailBgImage: 'assets/images/hero-banner-image.png',
    quotes: [
      { 
        id: 'q-3-1', 
        text: '세상은 참 생각지도 못한 일들로 가득 차 있어서 즐거워요.', 
        tail: 'L', 
        x: 320, 
        y: 280,
        bgGradient: { color1: '#FEE2E2', color2: '#FECACA', direction: '90deg', opacity: 85 }
      }
    ]
  },
  {
    id: 'book-4',
    title: '피터팬 : 네버랜드의 꿈',
    subtitle: 'Peter Pan',
    concept: '모험 판타지',
    spineTitle: '바다의 일기',
    spineHeight: 220,
    spineColor: '#3D5A6C',
    participatingCharacters: ['피터팬', '웬디', '팅커벨'],
    contact: '010-7777-7777',
    status: 'active',
    spineImage: '',
    coverImage: 'assets/images/popup-cover-image.png',
    detailBgImage: 'assets/images/hero-banner-image.png',
    quotes: [
      { 
        id: 'q-4-1', 
        text: '네버랜드로 가자, 생각만 하면 날 수 있어!', 
        tail: 'R', 
        x: 450, 
        y: 310,
        bgGradient: { color1: '#3B82F6', color2: '#1E40AF', direction: '45deg', opacity: 75 }
      }
    ]
  },
  {
    id: 'book-5',
    title: '달빛 아래 : 깊은 밤 하늘빛',
    subtitle: 'Under the Moonlight',
    concept: '환상 동화',
    spineTitle: '달빛 아래',
    spineHeight: 230,
    spineColor: '#52436D',
    participatingCharacters: ['루나', '아리'],
    contact: '010-8888-8888',
    status: 'active',
    spineImage: '',
    coverImage: 'assets/images/popup-cover-image.png',
    detailBgImage: 'assets/images/hero-banner-image.png',
    quotes: [
      { 
        id: 'q-5-1', 
        text: '달빛 아래에서 춤추는 요정들을 보았니?', 
        tail: 'C', 
        x: 600, 
        y: 250,
        bgGradient: { color1: '#4C1D95', color2: '#2E1065', direction: '135deg', opacity: 90 }
      }
    ]
  }
];

// Initialize database
function getBooks() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BOOKS));
    return DEFAULT_BOOKS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse books DB', e);
    return DEFAULT_BOOKS;
  }
}

function saveBooks(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

// Get Book by ID
function getBookById(id) {
  const books = getBooks();
  return books.find(b => b.id === id) || null;
}

// Add new Book
function addBook(book) {
  const books = getBooks();
  book.id = 'book-' + (Date.now());
  books.push(book);
  saveBooks(books);
  return book;
}

// Update existing Book
function updateBook(updatedBook) {
  const books = getBooks();
  const index = books.findIndex(b => b.id === updatedBook.id);
  if (index !== -1) {
    books[index] = updatedBook;
    saveBooks(books);
  }
}

// Delete Book
function deleteBook(id) {
  let books = getBooks();
  books = books.filter(b => b.id !== id);
  saveBooks(books);
}
