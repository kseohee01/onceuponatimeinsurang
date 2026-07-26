document.addEventListener('DOMContentLoaded', () => {
  const views = {
    intro: document.getElementById('view-intro'),
    bookshelf: document.getElementById('view-bookshelf'),
    detail: document.getElementById('view-detail')
  };
  const modal = document.getElementById('popup-modal');
  const toast = document.getElementById('app-toast');
  const booksPerShelf = 5;
  let selectedBook = null;
  let uiVisible = true;
  let toastTimer = null;

  function showView(name) {
    Object.entries(views).forEach(([key, element]) => {
      element.classList.toggle('active', key === name);
    });
    document.body.dataset.view = name;
    if (name === 'bookshelf') renderBookshelf();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function activeBooks() {
    return getBooks()
      .filter((book) => book.status === 'active')
      .sort((a, b) => (a.shelfOrder ?? 999) - (b.shelfOrder ?? 999));
  }

  function createSpine(book, visualIndex) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `book-spine${[3, 8, 11].includes(visualIndex) ? ' framed' : ''}`;
    const visualHeight = Math.max(
      190,
      Math.min(270, Number(book.spineHeight) || getAutomaticSpineHeight(visualIndex))
    );
    button.style.setProperty('--spine-height', `${visualHeight}px`);
    button.style.setProperty('--spine-color', book.spineColor || '#6d4f3d');
    if (book.spineImage) {
      button.style.backgroundImage = `linear-gradient(90deg, rgba(255,255,255,.08), transparent 12%, transparent 84%, rgba(0,0,0,.25)), url("${book.spineImage}")`;
      button.style.backgroundSize = 'auto, cover';
      button.style.backgroundPosition = 'center';
    }
    button.textContent = book.title;
    button.setAttribute('aria-label', `${book.title} 열기`);
    button.addEventListener('click', () => openBook(book));
    return button;
  }

  function renderBookshelf() {
    const books = activeBooks();
    const shelves = document.getElementById('shelves-list');
    const shelfCount = Math.max(3, Math.ceil(books.length / booksPerShelf));
    shelves.replaceChildren();

    for (let shelfIndex = 0; shelfIndex < shelfCount; shelfIndex += 1) {
      const row = document.createElement('div');
      row.className = 'shelf-row';
      const booksRow = document.createElement('div');
      booksRow.className = 'books-row';
      const start = shelfIndex * booksPerShelf;
      books.slice(start, start + booksPerShelf).forEach((book, index) => {
        booksRow.appendChild(createSpine(book, start + index));
      });
      if (!books.length && shelfIndex === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'empty-shelf-message';
        emptyMessage.textContent = '아직 책장에 등록된 이야기가 없습니다.';
        booksRow.appendChild(emptyMessage);
      }
      const beam = document.createElement('div');
      beam.className = 'wood-beam';
      row.append(booksRow, beam);
      shelves.appendChild(row);
    }
  }

  function openBook(book) {
    selectedBook = book;
    document.getElementById('popup-cover-img').src = book.coverImage || FIGMA_COVER;
    document.getElementById('popup-project-label').textContent = book.concept || '페어명';
    document.getElementById('popup-characters-row').textContent =
      (book.participatingCharacters || []).slice(0, 3).join('  X  ') || '캐릭터 이름 X 캐릭터 이름';
    document.getElementById('popup-book-subtitle').textContent = book.subtitle || 'Once Upon a Time';
    document.getElementById('popup-book-title').textContent = book.title;
    document.getElementById('popup-book-desc').textContent =
      book.description || `${book.title}의 인물들이 수랑고에서 만나 새롭게 써 내려가는 이야기입니다.`;
    modal.classList.add('open');
    document.getElementById('btn-close-popup').focus();
  }

  function closeBook() {
    modal.classList.remove('open');
  }

  function rgbaFromHex(hex, opacity) {
    const normalized = String(hex || '#231812').replace('#', '');
    const value = normalized.length === 3
      ? normalized.split('').map((character) => character + character).join('')
      : normalized.padEnd(6, '0');
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, Number(opacity) / 100))})`;
  }

  function renderDetail(book) {
    selectedBook = book;
    const image = book.detailBgImage || FIGMA_DETAIL;
    const detailImage = document.getElementById('detail-bg-img');
    const backdrop = document.getElementById('detail-backdrop');
    detailImage.style.backgroundImage = `url("${image}")`;
    backdrop.style.backgroundImage = `url("${image}")`;

    document.getElementById('detail-gradient-overlay').style.background = 'transparent';

    document.getElementById('detail-characters').textContent =
      (book.participatingCharacters || []).join('  X  ');
    document.getElementById('detail-subtitle').textContent = book.subtitle || '';
    document.getElementById('detail-title').textContent = book.title || '';
    document.getElementById('detail-description').textContent = book.description || '';

    const bubbleContainer = document.getElementById('bubble-container');
    bubbleContainer.replaceChildren();
    (book.quotes || []).slice(0, 8).forEach((quote) => {
      const bubble = document.createElement('div');
      bubble.className = `story-bubble tail-${quote.tail || 'C'}`;
      bubble.textContent = quote.text;
      const bubbleGradient = { ...DEFAULT_GRADIENT, ...(quote.bgGradient || {}) };
      bubble.style.background =
        `linear-gradient(${bubbleGradient.direction}, ${rgbaFromHex(bubbleGradient.color1, bubbleGradient.opacity)}, ${rgbaFromHex(bubbleGradient.color2, bubbleGradient.opacity)})`;
      bubble.style.left = `${Math.max(0, Math.min(96, (Number(quote.x) / 1200) * 100))}%`;
      bubble.style.top = `${Math.max(0, Math.min(94, (Number(quote.y) / 750) * 100))}%`;
      bubbleContainer.appendChild(bubble);
    });

    uiVisible = true;
    updateUiVisibility();
    closeBook();
    showView('detail');
  }

  function updateUiVisibility() {
    document.getElementById('detail-ui-layer').classList.toggle('hidden', !uiVisible);
    const toggle = document.getElementById('btn-ui-toggle');
    toggle.setAttribute('aria-pressed', String(uiVisible));
    document.getElementById('ui-toggle-switch').style.filter = uiVisible
      ? 'none'
      : 'grayscale(1) brightness(.7)';
  }

  document.getElementById('btn-enter').addEventListener('click', () => showView('bookshelf'));
  document.getElementById('header-logo-home').addEventListener('click', () => showView('intro'));
  document.getElementById('btn-close-popup').addEventListener('click', closeBook);
  document.getElementById('btn-read-more').addEventListener('click', () => {
    if (selectedBook) renderDetail(selectedBook);
  });
  document.getElementById('btn-back-to-shelf').addEventListener('click', () => showView('bookshelf'));
  document.getElementById('btn-ui-toggle').addEventListener('click', () => {
    uiVisible = !uiVisible;
    updateUiVisibility();
  });
  document.getElementById('btn-minigame').addEventListener('click', () => {
    showToast('미니게임은 다음 이야기에서 공개됩니다.');
  });
  document.getElementById('btn-guest-note').addEventListener('click', () => {
    showToast('방명록은 준비 중입니다.');
  });
  document.getElementById('btn-process').addEventListener('click', () => {
    showToast('제작 과정 페이지는 관리자 검수 후 공개됩니다.');
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.classList.contains('popup-scrim')) closeBook();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeBook();
  });

  function startDust() {
    const canvas = document.getElementById('magic-dust-canvas');
    const context = canvas.getContext('2d');
    const particles = Array.from({ length: 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.6 + 0.35,
      alpha: Math.random() * 0.4 + 0.08,
      speed: Math.random() * 0.00009 + 0.00002
    }));

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw() {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((particle) => {
        particle.y -= particle.speed;
        particle.x += Math.sin(particle.y * 18) * 0.000015;
        if (particle.y < -0.02) {
          particle.y = 1.02;
          particle.x = Math.random();
        }
        const gradient = context.createRadialGradient(
          particle.x * window.innerWidth,
          particle.y * window.innerHeight,
          0,
          particle.x * window.innerWidth,
          particle.y * window.innerHeight,
          particle.size * 5
        );
        gradient.addColorStop(0, `rgba(255,232,190,${particle.alpha})`);
        gradient.addColorStop(1, 'rgba(255,232,190,0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(
          particle.x * window.innerWidth,
          particle.y * window.innerHeight,
          particle.size * 5,
          0,
          Math.PI * 2
        );
        context.fill();
      });
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) draw();
  }

  renderBookshelf();
  subscribeBooks(() => {
    renderBookshelf();
    if (!selectedBook) return;
    const updatedBook = getBookById(selectedBook.id);
    if (!updatedBook || updatedBook.status !== 'active') {
      selectedBook = null;
      closeBook();
      if (views.detail.classList.contains('active')) showView('bookshelf');
      return;
    }
    selectedBook = updatedBook;
    if (modal.classList.contains('open')) openBook(updatedBook);
    if (views.detail.classList.contains('active')) renderDetail(updatedBook);
  });
  startDust();
});
