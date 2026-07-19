// Client Site Interaction and Canvas Effects

// State management
let currentBookId = null;

// DOM Elements
const viewIntro = document.getElementById('view-intro');
const viewBookshelf = document.getElementById('view-bookshelf');
const viewDetail = document.getElementById('view-detail');
const popupModal = document.getElementById('popup-modal');

// -------------------------------------------------------------
// 1. MAGIC DUST CANVAS PARTICLES
// -------------------------------------------------------------
const canvas = document.getElementById('magic-dust-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
const particleCount = 40;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height + canvas.height; // Start off screen bottom
    this.radius = Math.random() * 3 + 1;
    this.speedY = -(Math.random() * 0.8 + 0.2);
    this.speedX = Math.random() * 0.4 - 0.2;
    this.alpha = Math.random() * 0.5 + 0.1;
    this.fadeSpeed = Math.random() * 0.005 + 0.002;
    this.amplitude = Math.random() * 20 + 5;
    this.frequency = Math.random() * 0.02 + 0.005;
    this.angle = Math.random() * Math.PI;
  }

  update() {
    this.y += this.speedY;
    this.angle += this.frequency;
    this.x += this.speedX + Math.sin(this.angle) * 0.2;

    // Fade in/out logic
    if (this.y < 0 || this.alpha <= 0) {
      this.reset();
      this.y = canvas.height + Math.random() * 20;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(223, 186, 139, ${this.alpha})`; // Light gold
    ctx.shadowBlur = this.radius * 2;
    ctx.shadowColor = '#DFBA8B';
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow
  }
}

// Initialize particles
for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle());
  // Pre-distribute them vertically
  particles[i].y = Math.random() * canvas.height;
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  
  requestAnimationFrame(animateParticles);
}
animateParticles();

// -------------------------------------------------------------
// 2. ROUTING & SWITCHING VIEWS
// -------------------------------------------------------------
function switchView(viewName) {
  viewIntro.classList.remove('active');
  viewBookshelf.classList.remove('active');
  viewDetail.classList.remove('active');

  if (viewName === 'intro') {
    viewIntro.classList.add('active');
  } else if (viewName === 'bookshelf') {
    viewBookshelf.classList.add('active');
    renderBookshelf();
  } else if (viewName === 'detail') {
    viewDetail.classList.add('active');
  }
}

// Intro Entry button
document.getElementById('btn-enter').addEventListener('click', () => {
  switchView('bookshelf');
});

// Logo Home button
document.getElementById('header-logo-home').addEventListener('click', () => {
  switchView('intro');
});

// Navigation links
document.getElementById('nav-shelf').addEventListener('click', (e) => {
  e.preventDefault();
  switchView('bookshelf');
});

document.getElementById('nav-archive').addEventListener('click', (e) => {
  e.preventDefault();
  alert('이야기 보관소 준비 중입니다.');
});

document.getElementById('nav-author').addEventListener('click', (e) => {
  e.preventDefault();
  alert('책방지기 소개 준비 중입니다.');
});

// Back to Shelf from Detail
document.getElementById('btn-back-to-shelf').addEventListener('click', () => {
  switchView('bookshelf');
});

// -------------------------------------------------------------
// 3. BOOKSHELF RENDERER
// -------------------------------------------------------------
function renderBookshelf() {
  // Clear existing
  document.getElementById('shelf-books-0').innerHTML = '';
  document.getElementById('shelf-books-1').innerHTML = '';
  document.getElementById('shelf-books-2').innerHTML = '';

  const activeBooks = getBooks().filter(b => b.status === 'active');
  
  activeBooks.forEach((book, index) => {
    // Distribute into shelves (5 per shelf)
    const shelfIndex = Math.floor(index / 5);
    const shelfContainer = document.getElementById(`shelf-books-${shelfIndex}`);
    
    if (shelfContainer) {
      const spine = document.createElement('div');
      spine.className = 'book-spine-item';
      spine.style.height = `${book.spineHeight || 240}px`;
      spine.style.backgroundColor = book.spineColor || '#B27171';
      
      // If there is a custom spine image upload, use it as bg instead
      if (book.spineImage) {
        spine.style.backgroundImage = `url(${book.spineImage})`;
        spine.style.backgroundSize = 'cover';
        spine.style.backgroundPosition = 'center';
      }

      spine.innerHTML = `
        <div class="top-stripe"></div>
        <div class="rotated-title-container">
          <span class="spine-title">${book.spineTitle || book.title}</span>
        </div>
        <div class="bottom-badge">
          <div class="badge-circle"></div>
          <div class="badge-line"></div>
        </div>
      `;

      spine.addEventListener('click', () => {
        openPopup(book.id);
      });

      shelfContainer.appendChild(spine);
    }
  });
}

// -------------------------------------------------------------
// 4. BOOK POPUP MODAL
// -------------------------------------------------------------
function openPopup(bookId) {
  const book = getBookById(bookId);
  if (!book) return;

  currentBookId = bookId;

  // Populate data
  document.getElementById('popup-cover-img').src = book.coverImage || 'assets/images/popup-cover-image.png';
  document.getElementById('popup-design-no').textContent = `Book Design No. ${book.id.replace('book-', '')}`;
  
  // Characters
  const charactersRow = document.getElementById('popup-characters-row');
  charactersRow.innerHTML = '';
  if (book.participatingCharacters && book.participatingCharacters.length > 0) {
    book.participatingCharacters.forEach((char, idx) => {
      const span = document.createElement('span');
      span.textContent = char;
      charactersRow.appendChild(span);

      if (idx < book.participatingCharacters.length - 1) {
        const divider = document.createElement('span');
        divider.className = 'character-divider';
        divider.textContent = 'X';
        charactersRow.appendChild(divider);
      }
    });
  } else {
    charactersRow.innerHTML = '<span>참여 캐릭터 없음</span>';
  }

  // Titles & Desc
  document.getElementById('popup-book-title').textContent = book.title;
  document.getElementById('popup-book-subtitle').textContent = book.subtitle || '';
  document.getElementById('popup-book-desc').textContent = book.desc || `${book.title}에 관한 상세 포트폴리오 설명 및 작업 내용을 담은 책입니다.`;

  // Trigger modal display and animations
  popupModal.classList.add('active');
}

function closePopup() {
  popupModal.classList.remove('active');
}

document.getElementById('btn-close-popup').addEventListener('click', closePopup);

// Close on clicking backdrop overlay
popupModal.addEventListener('click', (e) => {
  if (e.target === popupModal) {
    closePopup();
  }
});

// Navigate from popup to detail
document.getElementById('btn-read-more').addEventListener('click', () => {
  if (currentBookId) {
    closePopup();
    loadDetailPage(currentBookId);
  }
});

document.getElementById('btn-process').addEventListener('click', () => {
  alert('작업 과정 준비 중입니다.');
});

// -------------------------------------------------------------
// 5. DETAIL PAGE RENDERER
// -------------------------------------------------------------
function loadDetailPage(bookId) {
  const book = getBookById(bookId);
  if (!book) return;

  // Set Background Image
  const bgImg = document.getElementById('detail-bg-img');
  if (book.detailBgImage) {
    bgImg.style.backgroundImage = `url(${book.detailBgImage})`;
  } else {
    bgImg.style.backgroundImage = 'none';
  }

  // Clear existing bubbles
  const bubbleContainer = document.getElementById('bubble-container');
  bubbleContainer.innerHTML = '';

  // Inject Quote Bubbles
  if (book.quotes && book.quotes.length > 0) {
    book.quotes.forEach((q, idx) => {
      const bubbleGroup = document.createElement('div');
      bubbleGroup.className = `quote-bubble-group tail-${q.tail || 'C'}`;
      
      // Positioning coordinates inside 1920x1080 resolution viewport frame
      bubbleGroup.style.left = `${q.x || 100}px`;
      bubbleGroup.style.top = `${q.y || 100}px`;
      
      // Delay animation to look organic
      bubbleGroup.style.animationDelay = `${idx * 0.6}s`;

      bubbleGroup.innerHTML = `
        <div class="quote-bubble">
          <p>“${q.text}”</p>
        </div>
        <div class="bubble-tail-vector"></div>
      `;

      // Get gradient specifically for this quote bubble, merging properties defensively
      const qGradient = Object.assign({
        color1: '#000000',
        color2: '#000000',
        direction: '180deg',
        opacity: 55
      }, q.bgGradient || {});
      const qAlpha = (qGradient.opacity / 100).toFixed(2);
      const qc1 = hexToRgba(qGradient.color1, qAlpha);
      const qc2 = hexToRgba(qGradient.color2, qAlpha);

      // Apply dynamic colors to bubble body and tail SVG mask
      const bubbleDiv = bubbleGroup.querySelector('.quote-bubble');
      bubbleDiv.style.background = `linear-gradient(${qGradient.direction}, ${qc1} 0%, ${qc2} 100%)`;
      bubbleGroup.style.setProperty('--bubble-tail-color', qc2);

      bubbleContainer.appendChild(bubbleGroup);
    });
  }

  // Reset UI switch toggle active state
  document.body.classList.remove('hide-ui');

  switchView('detail');

  // Recalculate frame container scale
  setTimeout(resizeDetailContainer, 50);
}

// UI Toggle Switch
const uiToggleBtn = document.getElementById('btn-ui-toggle');
uiToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('hide-ui');
});

// Helper: Convert hex color to RGBA (robust parseInt version)
function hexToRgba(hex, alpha) {
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    let cleanHex = hex.substring(1);
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(char => char + char).join('');
    }
    const num = parseInt(cleanHex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

// Fit 1920x1080 detail page container inside the frame outer wrapper
function resizeDetailContainer() {
  const container = document.querySelector('.detail-aspect-ratio-container');
  const wrapper = document.querySelector('.detail-frame-outer-wrapper');
  if (container && wrapper) {
    const wrapperWidth = wrapper.offsetWidth - 48; // accounting for padding
    const wrapperHeight = wrapper.offsetHeight - 48;
    
    // Fit math (contain):
    const scaleX = wrapperWidth / 1920;
    const scaleY = wrapperHeight / 1080;
    const scale = Math.min(scaleX, scaleY);
    
    container.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
}
window.addEventListener('resize', resizeDetailContainer);

// Initial load
window.addEventListener('load', () => {
  // If we loaded with an empty shelf database, it initiates DEFAULT_BOOKS
  getBooks();
});
