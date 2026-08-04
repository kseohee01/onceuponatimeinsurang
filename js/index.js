document.addEventListener('DOMContentLoaded', async () => {
  const views = {
    intro: document.getElementById('view-intro'),
    bookshelf: document.getElementById('view-bookshelf'),
    detail: document.getElementById('view-detail')
  };
  const modal = document.getElementById('popup-modal');
  const toast = document.getElementById('app-toast');
  const detailView = views.detail;
  const introBook = document.querySelector('.intro-book');
  const introMobileStage = document.querySelector('.intro-mobile-stage');
  const shelfLayoutStage = document.querySelector('.shelf-layout-stage');
  const bgmAudio = document.getElementById('site-bgm-audio');
  const bgmWidgets = [...document.querySelectorAll('.site-bgm-widget')];
  const booksPerShelf = 5;
  let selectedBook = null;
  let uiVisible = true;
  let detailLandscape = false;
  let toastTimer = null;
  let viewTransitionTimer = null;
  let bgmObjectUrl = '';
  let bgmName = '';
  let bgmUpdatedAt = 0;
  let bgmLoadSequence = 0;
  let bgmPlayRequested = true;
  let bgmAutoplayPending = false;
  let detailRenderSequence = 0;
  const detailImagePreloads = new Map();

  function updateIntroBookScale() {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const mobile = viewportWidth < viewportHeight;
    const designWidth = mobile ? 390 : 1440;
    const designHeight = mobile ? 844 : 900;
    const scale = Math.min(viewportWidth / designWidth, viewportHeight / designHeight);
    introBook.style.setProperty('--intro-book-scale', String(scale));
    if (mobile) {
      const stageWidth = 390 * scale;
      const stageHeight = 844 * scale;
      introMobileStage.style.width = `${stageWidth}px`;
      introMobileStage.style.height = `${stageHeight}px`;
      const stageLeft = (viewportWidth - stageWidth) / 2;
      introMobileStage.style.left = `${stageLeft}px`;
      introMobileStage.style.top = `${(viewportHeight - stageHeight) / 2}px`;
      introMobileStage.style.setProperty('--mobile-left-offset', `${-stageLeft}px`);
      introMobileStage.style.setProperty('--mobile-right-offset', `${-(viewportWidth - stageLeft - stageWidth)}px`);
    } else {
      introMobileStage.removeAttribute('style');
    }
    shelfLayoutStage.style.setProperty('--shelf-stage-scale', String(scale));
    const shelfStageWidth = designWidth * scale;
    const siteFrameWidth = mobile
      ? viewportWidth
      : Math.min(viewportWidth, viewportHeight * 16 / 9);
    const shelfSideExtension = Math.max(0, (siteFrameWidth - shelfStageWidth) / 2 / scale);
    shelfLayoutStage.style.setProperty('--shelf-left-extension', `${-shelfSideExtension}px`);
    shelfLayoutStage.style.setProperty('--shelf-right-extension', `${-shelfSideExtension}px`);
    views.intro.classList.add('intro-scale-ready');
    views.bookshelf.classList.add('shelf-scale-ready');
  }

  function updatePopupScale() {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (viewportWidth < viewportHeight) {
      modal.style.removeProperty('--popup-scale');
      return;
    }
    const siteFrameWidth = Math.min(viewportWidth, viewportHeight * 16 / 9);
    const availableWidth = Math.max(1, siteFrameWidth - 40);
    const availableHeight = Math.max(1, viewportHeight - 40);
    const popupScale = Math.min(1, availableWidth / 920, availableHeight / 620);
    modal.style.setProperty('--popup-scale', String(popupScale));
  }

  updateIntroBookScale();
  updatePopupScale();
  await initializeSurangData({ allowLocalSeed: false });

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
    if (name === 'bookshelf') {
      views.bookshelf.classList.remove('shelf-animating');
      renderBookshelf();
      void views.bookshelf.offsetWidth;
      views.bookshelf.classList.add('shelf-animating');
    }
    if (name === 'detail') {
      views.detail.classList.remove('detail-animating');
      void views.detail.offsetWidth;
      views.detail.classList.add('detail-animating');
    }
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
      120,
      Math.min(270, Number(book.spineHeight) || getAutomaticSpineHeight(visualIndex))
    );
    const visualWidth = Math.max(30, Math.min(120, Number(book.spineWidth) || 60));
    button.style.setProperty('--spine-height', `${visualHeight}px`);
    button.style.setProperty('--spine-width', `${visualWidth}px`);
    button.style.setProperty('--mobile-spine-width', `${Math.round(visualWidth * 5 / 6)}px`);
    const bookRowIndex = Math.floor(visualIndex / booksPerShelf);
    const bookColumnIndex = visualIndex % booksPerShelf;
    button.style.setProperty('--shelf-book-delay', `${90 + bookRowIndex * 140 + bookColumnIndex * 45}ms`);
    button.style.setProperty('--spine-color', book.spineColor || '#6d4f3d');
    if (book.spineImage) {
      button.style.backgroundImage = `url("${book.spineImage}")`;
      button.style.backgroundSize = 'cover';
      button.style.backgroundPosition = 'center';
    }
    button.setAttribute('aria-label', `${book.title} 열기`);
    button.addEventListener('click', () => openBook(book));
    return button;
  }

  function renderBookshelf() {
    const books = activeBooks();
    const shelves = document.getElementById('shelves-list');
    const shelfCount = Math.max(3, Math.ceil(books.length / booksPerShelf));
    shelves.replaceChildren();
    shelves.parentElement.classList.toggle('is-scrollable', shelfCount > 3);

    for (let shelfIndex = 0; shelfIndex < shelfCount; shelfIndex += 1) {
      const row = document.createElement('div');
      row.className = 'shelf-row';
      row.style.setProperty('--shelf-row-delay', `${shelfIndex * 140}ms`);
      row.style.setProperty('--shelf-beam-delay', `${70 + shelfIndex * 140}ms`);
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
    preloadDetailImage(book.detailBgImage || FIGMA_DETAIL);
    updatePopupScale();
    modal.classList.add('open');
    document.getElementById('btn-close-popup').focus();
  }

  function closeBook({ animate = false } = {}) {
    if (!modal.classList.contains('open')) return;
    if (animate) {
      modal.classList.remove('close-immediate');
      modal.classList.remove('open');
      return;
    }
    modal.classList.add('close-immediate');
    modal.classList.remove('open');
    requestAnimationFrame(() => modal.classList.remove('close-immediate'));
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
    const sunBokehCanvases = [...document.querySelectorAll('.sun-bokeh-canvas')];
    const canvasStates = new WeakMap();
    const sunBokehStates = new WeakMap();
    const motionScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
    let previousTime = performance.now();

    function createMotes(width, height) {
      const count = width < 768 ? 12 : 18;
      return Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 48 + Math.random() * 88,
        speed: 5 + Math.random() * 10,
        drift: 18 + Math.random() * 44,
        alpha: 0.04 + Math.random() * 0.04,
        phase: Math.random() * Math.PI * 2,
        twinkle: 1.2 + Math.random() * 2.2
      }));
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

    function createSunBokeh(width, height) {
      const count = width < 768 ? 5 : 7;
      const minimumRadius = Math.min(width, height) * (width < 768 ? 0.2 : 0.18);
      return Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: minimumRadius * (1 + Math.random() * 1.15),
        driftX: 22 + Math.random() * 58,
        driftY: 14 + Math.random() * 38,
        phase: Math.random() * Math.PI * 2,
        pace: 0.000045 + Math.random() * 0.00004
      }));
    }

    function prepareSunBokehCanvas(canvas) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      let state = sunBokehStates.get(canvas);
      if (!state || state.width !== rect.width || state.height !== rect.height || state.ratio !== ratio) {
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        state = {
          width: rect.width,
          height: rect.height,
          ratio,
          bokeh: createSunBokeh(rect.width, rect.height)
        };
        sunBokehStates.set(canvas, state);
      }
      return state;
    }

    function drawSunBokeh(canvas, state, time) {
      const context = canvas.getContext('2d');
      context.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
      context.clearRect(0, 0, state.width, state.height);

      state.bokeh.forEach((bokeh) => {
        const motionTime = time * bokeh.pace * motionScale;
        const x = bokeh.x + Math.sin(motionTime + bokeh.phase) * bokeh.driftX;
        const y = bokeh.y + Math.cos(motionTime * 0.78 + bokeh.phase) * bokeh.driftY;
        const pulse = 0.72 + Math.sin(motionTime * 1.35 + bokeh.phase) * 0.18;
        const radius = bokeh.radius * (0.96 + pulse * 0.08);
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(255, 176, 91, ${0.82 * pulse})`);
        gradient.addColorStop(0.28, `rgba(255, 145, 61, ${0.48 * pulse})`);
        gradient.addColorStop(0.7, `rgba(241, 103, 35, ${0.12 * pulse})`);
        gradient.addColorStop(1, 'rgba(226, 83, 24, 0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawCanvas(canvas, state, time, delta) {
      const context = canvas.getContext('2d');
      context.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
      context.clearRect(0, 0, state.width, state.height);

      state.motes.forEach((mote) => {
        mote.y -= mote.speed * delta * motionScale;
        if (mote.y < -mote.radius * 2) {
          mote.y = state.height + mote.radius * 2;
          mote.x = Math.random() * state.width;
        }
        const x = mote.x + Math.sin(time * 0.00035 + mote.phase) * mote.drift * motionScale;
        const pulse = 0.62 + Math.sin(time * 0.001 * mote.twinkle + mote.phase) * 0.38;

        const gradient = context.createRadialGradient(x, mote.y, 0, x, mote.y, mote.radius);
        gradient.addColorStop(0, `rgba(255, 235, 202, ${mote.alpha * pulse * 0.72})`);
        gradient.addColorStop(0.22, `rgba(255, 211, 164, ${mote.alpha * pulse * 0.34})`);
        gradient.addColorStop(0.66, `rgba(225, 176, 132, ${mote.alpha * pulse * 0.09})`);
        gradient.addColorStop(1, 'rgba(225, 176, 132, 0)');
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
      sunBokehCanvases.forEach((canvas) => {
        const state = prepareSunBokehCanvas(canvas);
        if (state) drawSunBokeh(canvas, state, time);
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

  function preloadDetailImage(source) {
    if (detailImagePreloads.has(source)) return detailImagePreloads.get(source);
    const preload = new Promise((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = resolve;
      image.onerror = resolve;
      image.src = source;
      if (image.complete) {
        if (typeof image.decode === 'function') image.decode().then(resolve, resolve);
        else resolve();
      }
    });
    detailImagePreloads.set(source, preload);
    return preload;
  }

  async function renderDetail(book) {
    const renderSequence = ++detailRenderSequence;
    const detailWasActive = views.detail.classList.contains('active');
    selectedBook = book;
    const image = book.detailBgImage || FIGMA_DETAIL;
    await preloadDetailImage(image);
    if (renderSequence !== detailRenderSequence || selectedBook?.id !== book.id) return;
    if (!detailWasActive && !modal.classList.contains('open')) return;
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
    const uiLayer = document.getElementById('detail-ui-layer');
    uiLayer.classList.toggle('hidden', !uiVisible);
    uiLayer.inert = !uiVisible;
    uiLayer.setAttribute('aria-hidden', String(!uiVisible));
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
      bgmAutoplayPending = false;
      updateBgmWidgets();
      return false;
    }
    try {
      await bgmAudio.play();
      bgmAutoplayPending = false;
      return true;
    } catch (error) {
      bgmAutoplayPending = bgmPlayRequested;
      updateBgmWidgets();
      return false;
    }
  }

  async function loadHomepageBgm(settings = null) {
    const nextName = String(settings?.bgmName || '');
    const nextUpdatedAt = Number(settings?.bgmUpdatedAt) || 0;
    if (settings && nextName === bgmName && nextUpdatedAt === bgmUpdatedAt) return;

    const sequence = ++bgmLoadSequence;
    try {
      const bgm = await getHomepageBgm();
      if (sequence !== bgmLoadSequence) return;

      const loadedName = String(bgm.bgmName || '');
      const loadedUpdatedAt = Number(bgm.bgmUpdatedAt) || 0;
      if (bgmAudio.src && loadedName === bgmName && loadedUpdatedAt === bgmUpdatedAt) return;

      if (bgmObjectUrl) URL.revokeObjectURL(bgmObjectUrl);
      bgmObjectUrl = '';
      bgmName = loadedName;
      bgmUpdatedAt = loadedUpdatedAt;
      if (!bgm.blob) {
        bgmAutoplayPending = false;
        bgmAudio.removeAttribute('src');
        bgmAudio.load();
        updateBgmWidgets();
        return;
      }
      bgmObjectUrl = URL.createObjectURL(bgm.blob);
      bgmAudio.src = bgmObjectUrl;
      bgmAudio.loop = true;
      bgmAudio.load();
      if (bgmPlayRequested) await tryPlayBgm();
      else updateBgmWidgets();
    } catch (error) {
      console.warn('홈페이지 BGM을 불러오지 못했습니다.', error);
      updateBgmWidgets();
    }
  }

  document.getElementById('btn-enter').addEventListener('click', () => {
    showView('bookshelf');
  });
  document.getElementById('header-logo-home').addEventListener('click', () => showView('intro'));
  document.getElementById('btn-close-popup').addEventListener('click', () => closeBook({ animate: true }));
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
      if (bgmAudio.paused) {
        bgmPlayRequested = true;
        await tryPlayBgm();
      } else {
        bgmPlayRequested = false;
        bgmAutoplayPending = false;
        bgmAudio.pause();
      }
    });
  });
  bgmAudio.addEventListener('play', updateBgmWidgets);
  bgmAudio.addEventListener('pause', updateBgmWidgets);
  bgmAudio.addEventListener('error', updateBgmWidgets);
  function retryBlockedAutoplay(event) {
    if (event?.target?.closest?.('.site-bgm-widget')) return;
    if (bgmAutoplayPending && bgmPlayRequested && bgmAudio.paused) tryPlayBgm();
  }

  document.addEventListener('pointerdown', retryBlockedAutoplay);
  document.addEventListener('keydown', retryBlockedAutoplay);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && bgmPlayRequested && bgmAudio.paused) tryPlayBgm();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && detailLandscape) setDetailLandscape(false, { exitFullscreen: false });
  });
  window.addEventListener('resize', () => {
    updateIntroBookScale();
    updatePopupScale();
    updateBubbleLayout();
  });
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
