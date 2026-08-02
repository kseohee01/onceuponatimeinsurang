document.addEventListener('DOMContentLoaded', async () => {
  await initializeSurangData({ allowLocalSeed: false });
  const views = {
    intro: document.getElementById('view-intro'),
    bookshelf: document.getElementById('view-bookshelf'),
    detail: document.getElementById('view-detail')
  };
  const modal = document.getElementById('popup-modal');
  const toast = document.getElementById('app-toast');
  const detailView = views.detail;
  const bgmAudio = document.getElementById('site-bgm-audio');
  const bgmWidgets = [...document.querySelectorAll('.site-bgm-widget')];
  const booksPerShelf = 5;
  let selectedBook = null;
  let uiVisible = true;
  let detailLandscape = false;
  let toastTimer = null;
  let viewTransitionTimer = null;
  let bgmObjectUrl = '';
  function showView(name) {
    const nextView = views[name];
    const currentView = Object.values(views).find((element) => element.classList.contains('active'));
    if (currentView && currentView !== nextView) {
      clearTimeout(viewTransitionTimer);
      Object.values(views).forEach((element) => {
        element.classList.remove('view-entering', 'view-leaving', 'view-preparing');
        if (element !== currentView) element.classList.remove('active');
      });
      nextView.classList.add('active', 'view-preparing');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          currentView.classList.add('view-leaving');
          nextView.classList.remove('view-preparing');
          nextView.classList.add('view-entering');
        });
      });
      viewTransitionTimer = window.setTimeout(() => {
        currentView.classList.remove('active', 'view-leaving');
        nextView.classList.remove('view-entering', 'view-preparing');
      }, 660);
    } else if (!currentView) {
      nextView.classList.add('active', 'view-entering');
      viewTransitionTimer = window.setTimeout(() => nextView.classList.remove('view-entering'), 660);
    }
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
    button.className = 'book-spine';
    const visualHeight = Math.max(
      190,
      Math.min(270, Number(book.spineHeight) || getAutomaticSpineHeight(visualIndex))
    );
    const mobileVisualHeight = Math.round(170 + ((visualHeight - 190) / 80) * 30);
    button.style.setProperty('--spine-height', `${visualHeight}px`);
    button.style.setProperty('--mobile-spine-height', `${mobileVisualHeight}px`);
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

  function startAmbientParticles() {
    const canvases = [...document.querySelectorAll('.ambient-particle-canvas')];
    const canvasStates = new WeakMap();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previousTime = performance.now();

    function createMotes(width, height) {
      const count = width < 768 ? 24 : 38;
      return Array.from({ length: count }, (_, index) => {
        const sparkle = index % 5 === 0;
        return {
          sparkle,
          x: Math.random() * width,
          y: Math.random() * height,
          radius: sparkle ? 1 + Math.random() * 1.6 : 20 + Math.random() * 48,
          speed: sparkle ? 4 + Math.random() * 8 : 7 + Math.random() * 15,
          drift: 8 + Math.random() * 25,
          alpha: sparkle ? 0.24 + Math.random() * 0.35 : 0.035 + Math.random() * 0.075,
          phase: Math.random() * Math.PI * 2,
          twinkle: 0.8 + Math.random() * 1.8
        };
      });
    }

    function prepareCanvas(canvas) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      let state = canvasStates.get(canvas);
      if (!state || state.width !== rect.width || state.height !== rect.height || state.ratio !== ratio) {
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        state = {
          width: rect.width,
          height: rect.height,
          ratio,
          motes: createMotes(rect.width, rect.height)
        };
        canvasStates.set(canvas, state);
      }
      return state;
    }

    function drawCanvas(canvas, state, time, delta) {
      const context = canvas.getContext('2d');
      context.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
      context.clearRect(0, 0, state.width, state.height);

      state.motes.forEach((mote) => {
        if (!reducedMotion) {
          mote.y -= mote.speed * delta;
          if (mote.y < -mote.radius * 2) {
            mote.y = state.height + mote.radius * 2;
            mote.x = Math.random() * state.width;
          }
        }
        const x = mote.x + Math.sin(time * 0.00035 + mote.phase) * mote.drift;
        const pulse = 0.62 + Math.sin(time * 0.001 * mote.twinkle + mote.phase) * 0.38;

        if (mote.sparkle) {
          const length = 3 + mote.radius * 2.4;
          context.save();
          context.translate(x, mote.y);
          context.strokeStyle = `rgba(255, 240, 205, ${mote.alpha * pulse})`;
          context.lineWidth = 0.8;
          context.beginPath();
          context.moveTo(-length, 0);
          context.lineTo(length, 0);
          context.moveTo(0, -length);
          context.lineTo(0, length);
          context.stroke();
          context.fillStyle = `rgba(255, 250, 228, ${Math.min(0.9, mote.alpha * 1.7 * pulse)})`;
          context.beginPath();
          context.arc(0, 0, mote.radius, 0, Math.PI * 2);
          context.fill();
          context.restore();
          return;
        }

        const gradient = context.createRadialGradient(x, mote.y, 0, x, mote.y, mote.radius);
        gradient.addColorStop(0, `rgba(255, 224, 196, ${mote.alpha * pulse})`);
        gradient.addColorStop(0.42, `rgba(230, 190, 160, ${mote.alpha * 0.55 * pulse})`);
        gradient.addColorStop(1, 'rgba(230, 190, 160, 0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, mote.y, mote.radius, 0, Math.PI * 2);
        context.fill();
      });
    }

    function animate(time) {
      const delta = Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;
      canvases.forEach((canvas) => {
        const state = prepareCanvas(canvas);
        if (state) drawCanvas(canvas, state, time, delta);
      });
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function positionStoryBubbles() {
    const bubbleContainer = document.getElementById('bubble-container');
    const containerWidth = bubbleContainer.clientWidth;
    const containerHeight = bubbleContainer.clientHeight;
    if (!containerWidth || !containerHeight) return;
    const detailImage = document.getElementById('detail-bg-img');
    const imageWidth = detailImage.naturalWidth || BUBBLE_REFERENCE_WIDTH;
    const imageHeight = detailImage.naturalHeight || BUBBLE_REFERENCE_HEIGHT;

    bubbleContainer.querySelectorAll('.story-bubble').forEach((bubble) => {
      const projectedPoint = projectBubblePointToFrame(
        Number(bubble.dataset.x),
        Number(bubble.dataset.y),
        bubble.dataset.positionSpace,
        imageWidth,
        imageHeight,
        containerWidth,
        containerHeight
      );
      const renderedWidth = bubble.offsetWidth;
      const renderedHeight = bubble.offsetHeight;
      const horizontalInset = containerWidth * 0.0025;
      const verticalInset = containerWidth * 0.005;
      const left = Math.max(
        horizontalInset,
        Math.min(containerWidth - renderedWidth - horizontalInset, projectedPoint.left)
      );
      const top = Math.max(
        verticalInset,
        Math.min(containerHeight - renderedHeight - verticalInset, projectedPoint.top)
      );
      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
    });
  }

  function updateBubbleLayout() {
    if (!views.detail.classList.contains('active')) return;
    positionStoryBubbles();
  }

  function renderDetail(book) {
    selectedBook = book;
    const image = book.detailBgImage || FIGMA_DETAIL;
    const detailImage = document.getElementById('detail-bg-img');
    const backdropImage = document.getElementById('detail-backdrop-img');
    detailImage.src = image;
    backdropImage.src = image;

    document.getElementById('detail-gradient-overlay').style.removeProperty('background');

    document.getElementById('detail-characters').textContent =
      (book.participatingCharacters || []).join('  X  ');
    document.getElementById('detail-subtitle').textContent = book.subtitle || '';
    const detailTitle = document.getElementById('detail-title');
    const titleText = book.title || '';
    const titleLength = Array.from(titleText).length;
    detailTitle.textContent = titleText;
    detailTitle.style.setProperty(
      '--mobile-detail-title-size',
      titleLength > 18 ? '20px' : titleLength > 11 ? '24px' : '28px'
    );
    document.getElementById('detail-description').textContent = book.description || '';

    const bubbleContainer = document.getElementById('bubble-container');
    bubbleContainer.replaceChildren();
    (book.quotes || []).slice(0, 8).forEach((quote) => {
      const bubble = document.createElement('div');
      bubble.className = `story-bubble tail-${quote.tail || 'C'}`;
      bubble.textContent = quote.text;
      const bubbleColor = quote.bubbleColor || DEFAULT_BUBBLE_STYLE.color;
      const bubbleOpacity = Number(quote.bubbleOpacity ?? DEFAULT_BUBBLE_STYLE.opacity);
      const bubbleBackground = rgbaFromHex(bubbleColor, bubbleOpacity);
      bubble.style.setProperty('--bubble-background', bubbleBackground);
      bubble.style.setProperty('--bubble-tail-background', bubbleBackground);
      bubble.dataset.x = String(Number(quote.x) || 0);
      bubble.dataset.y = String(Number(quote.y) || 0);
      bubble.dataset.positionSpace = quote.positionSpace || LEGACY_BUBBLE_POSITION_SPACE;
      bubbleContainer.appendChild(bubble);
    });

    uiVisible = true;
    updateUiVisibility();
    closeBook();
    showView('detail');
    updateBubbleLayout();
  }

  function updateUiVisibility() {
    document.getElementById('detail-ui-layer').classList.toggle('hidden', !uiVisible);
    const toggle = document.getElementById('btn-ui-toggle');
    toggle.setAttribute('aria-pressed', String(uiVisible));
    document.getElementById('ui-toggle-switch').style.filter = uiVisible
      ? 'none'
      : 'grayscale(1) brightness(.7)';
  }

  function updateOrientationButton() {
    const button = document.getElementById('btn-orientation-toggle');
    button.setAttribute('aria-pressed', String(detailLandscape));
    button.setAttribute('aria-label', detailLandscape ? '세로 보기로 돌아가기' : '가로 보기');
    button.querySelector('.orientation-label').textContent = detailLandscape ? '세로 보기' : '가로 보기';
  }

  async function setDetailLandscape(enabled, options = {}) {
    detailLandscape = Boolean(enabled);
    detailView.classList.toggle('landscape-mode', detailLandscape);
    document.documentElement.classList.toggle('detail-landscape', detailLandscape);
    document.body.classList.toggle('detail-landscape', detailLandscape);
    updateOrientationButton();

    if (detailLandscape) {
      try {
        if (!document.fullscreenElement && detailView.requestFullscreen) {
          await detailView.requestFullscreen();
        }
      } catch (error) {
        console.info('전체 화면을 사용할 수 없어 페이지 내부 가로 보기로 전환합니다.', error);
      }
      try {
        if (screen.orientation?.lock) await screen.orientation.lock('landscape');
      } catch (error) {
        showToast('기기를 가로로 회전하면 더 크게 볼 수 있습니다.');
      }
    } else {
      try {
        screen.orientation?.unlock?.();
      } catch (error) {
        console.info('화면 방향 잠금을 해제하지 못했습니다.', error);
      }
      if (options.exitFullscreen !== false && document.fullscreenElement === detailView) {
        try {
          await document.exitFullscreen();
        } catch (error) {
          console.info('전체 화면을 종료하지 못했습니다.', error);
        }
      }
    }

    requestAnimationFrame(updateBubbleLayout);
  }

  function updateBgmWidgets() {
    const playing = Boolean(bgmAudio.src) && !bgmAudio.paused;
    bgmWidgets.forEach((button) => {
      button.dataset.state = playing ? 'playing' : 'paused';
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? 'BGM 일시정지' : 'BGM 재생');
    });
  }

  async function tryPlayBgm() {
    if (!bgmAudio.src) {
      updateBgmWidgets();
      return false;
    }
    try {
      await bgmAudio.play();
      return true;
    } catch (error) {
      updateBgmWidgets();
      return false;
    }
  }

  async function loadHomepageBgm() {
    try {
      const bgm = await getHomepageBgm();
      if (bgmObjectUrl) URL.revokeObjectURL(bgmObjectUrl);
      bgmObjectUrl = '';
      if (!bgm.blob) {
        bgmAudio.removeAttribute('src');
        bgmAudio.load();
        updateBgmWidgets();
        return;
      }
      bgmObjectUrl = URL.createObjectURL(bgm.blob);
      bgmAudio.src = bgmObjectUrl;
      bgmAudio.loop = true;
      bgmAudio.load();
      await tryPlayBgm();
    } catch (error) {
      console.warn('홈페이지 BGM을 불러오지 못했습니다.', error);
      updateBgmWidgets();
    }
  }

  document.getElementById('btn-enter').addEventListener('click', () => {
    showView('bookshelf');
  });
  document.getElementById('header-logo-home').addEventListener('click', () => showView('intro'));
  document.getElementById('btn-close-popup').addEventListener('click', closeBook);
  document.getElementById('btn-read-more').addEventListener('click', () => {
    if (selectedBook) renderDetail(selectedBook);
  });
  document.getElementById('btn-back-to-shelf').addEventListener('click', async () => {
    await setDetailLandscape(false);
    showView('bookshelf');
  });
  document.getElementById('btn-ui-toggle').addEventListener('click', () => {
    uiVisible = !uiVisible;
    updateUiVisibility();
  });
  document.getElementById('btn-orientation-toggle').addEventListener('click', () => {
    setDetailLandscape(!detailLandscape);
  });
  bgmWidgets.forEach((button) => {
    button.addEventListener('click', async () => {
      if (!bgmAudio.src) {
        showToast('관리자 페이지에서 홈페이지 BGM을 등록해 주세요.');
        return;
      }
      if (bgmAudio.paused) await tryPlayBgm();
      else bgmAudio.pause();
    });
  });
  bgmAudio.addEventListener('play', updateBgmWidgets);
  bgmAudio.addEventListener('pause', updateBgmWidgets);
  bgmAudio.addEventListener('error', updateBgmWidgets);
  document.addEventListener('pointerdown', () => {
    if (bgmAudio.paused) tryPlayBgm();
  }, { once: true });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && detailLandscape) setDetailLandscape(false, { exitFullscreen: false });
  });
  window.addEventListener('resize', updateBubbleLayout);
  document.getElementById('detail-bg-img').addEventListener('load', updateBubbleLayout);
  const detailResizeObserver = new ResizeObserver(updateBubbleLayout);
  detailResizeObserver.observe(document.querySelector('.detail-hero'));
  document.getElementById('btn-minigame').addEventListener('click', () => {
    showToast('미니게임은 다음 이야기에서 공개됩니다.');
  });
  document.getElementById('btn-guest-note').addEventListener('click', () => {
    showToast('방명록은 준비 중입니다.');
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.classList.contains('popup-scrim')) closeBook();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeBook();
  });

  renderBookshelf();
  startAmbientParticles();
  document.body.dataset.view = 'intro';
  updateOrientationButton();
  loadHomepageBgm();
  subscribeSiteSettings(loadHomepageBgm);
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
});
