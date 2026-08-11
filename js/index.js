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
  const shelfSceneStage = document.querySelector('.shelf-scene-stage');
  const shelfLayoutStage = document.querySelector('.shelf-layout-stage');
  const bgmAudio = document.getElementById('site-bgm-audio');
  const bookPopupSfx = document.getElementById('book-popup-sfx');
  const bgmWidgets = [...document.querySelectorAll('.site-bgm-widget')];
  const booksPerShelf = 6;
  let selectedBook = null;
  let uiVisible = true;
  let detailLandscape = false;
  let toastTimer = null;
  let viewTransitionTimer = null;
  let popupCloseTimer = null;
  let bgmObjectUrl = '';
  let bgmName = '';
  let bgmUpdatedAt = 0;
  let bgmCopyright = DEFAULT_BGM_COPYRIGHT;
  let bgmLoadSequence = 0;
  let bgmPlayRequested = true;
  let bgmAutoplayPending = false;
  let detailRenderSequence = 0;
  const detailImagePreloads = new Map();
  const popupCoverPreloads = new Map();
  let popupCoverPreloadScheduled = false;
  let popupCoverPreloadReschedule = false;
  const popupMobileMedia = window.matchMedia('(aspect-ratio < 4 / 5)');

  function dismissBookPopupForNavigation() {
    clearTimeout(popupCloseTimer);
    selectedBook = null;
    modal.classList.add('close-immediate');
    modal.classList.remove('open', 'closing-fade');
    modal.querySelector('.open-book').style.removeProperty('transform');
    requestAnimationFrame(() => modal.classList.remove('close-immediate'));
  }

  function resetTransientNavigationState() {
    clearTimeout(viewTransitionTimer);
    dismissBookPopupForNavigation();
    Object.values(views).forEach((view) => {
      view.classList.remove('active', 'view-entering', 'view-leaving', 'view-preparing');
    });
    views.intro.classList.add('active');
    document.body.dataset.view = 'intro';
  }

  resetTransientNavigationState();

  function updateIntroBookScale() {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const mobile = viewportWidth < viewportHeight;
    const designWidth = mobile ? 390 : 1440;
    const designHeight = mobile ? 844 : 900;
    const introScale = Math.min(viewportWidth / designWidth, viewportHeight / designHeight);
    const shelfScale = mobile
      ? Math.min(viewportWidth / designWidth, viewportHeight / designHeight)
      : viewportHeight / designHeight;
    introBook.style.setProperty('--intro-book-scale', String(introScale));
    shelfSceneStage.style.setProperty('--shelf-stage-scale', String(shelfScale));
    if (mobile) {
      const stageWidth = 390 * introScale;
      const stageHeight = 844 * introScale;
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
    const shelfStageWidth = designWidth * shelfScale;
    const siteFrameWidth = mobile
      ? viewportWidth
      : Math.min(viewportWidth, viewportHeight * 16 / 9);
    const shelfSideExtension = Math.max(0, (siteFrameWidth - shelfStageWidth) / 2 / shelfScale);
    shelfLayoutStage.style.setProperty('--shelf-left-extension', `${-shelfSideExtension}px`);
    shelfLayoutStage.style.setProperty('--shelf-right-extension', `${-shelfSideExtension}px`);
    shelfSceneStage.style.setProperty('--shelf-viewport-extension', `${shelfSideExtension}px`);
    views.intro.classList.add('intro-scale-ready');
    views.bookshelf.classList.add('shelf-scale-ready');
  }

  function updatePopupScale() {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (popupMobileMedia.matches) {
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

  function showView(name, { instant = false } = {}) {
    const nextView = views[name];
    const currentView = Object.values(views).find((element) => element.classList.contains('active'));
    if (instant) {
      clearTimeout(viewTransitionTimer);
      Object.values(views).forEach((element) => {
        element.classList.remove('active', 'view-entering', 'view-leaving', 'view-preparing');
      });
      nextView.classList.add('active');
    } else if (currentView && currentView !== nextView) {
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
      schedulePopupCoverPreload();
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

  function setManagedImage(image, source) {
    const currentSource = image.getAttribute('src') || '';
    const nextSource = source || '';
    if (currentSource === nextSource) {
      if (nextSource && image.complete && image.naturalWidth > 0) {
        image.classList.add('is-loaded');
      }
      return;
    }

    image.classList.remove('is-loaded');
    image.onload = () => {
      image.classList.add('is-loaded');
      if (image.id === 'detail-bg-img') updateBubbleLayout();
    };
    image.onerror = () => {
      image.classList.remove('is-loaded');
      image.removeAttribute('src');
    };
    if (nextSource) {
      image.src = nextSource;
      // A preloaded detail image can already be complete synchronously. Mark
      // it ready in the same frame so the popup never reveals a placeholder.
      if (image.complete && image.naturalWidth > 0) image.onload();
    } else image.removeAttribute('src');
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
    const mobileSpineScale = 5 / 6;
    button.style.setProperty('--spine-height', `${visualHeight}px`);
    button.style.setProperty('--spine-width', `${visualWidth}px`);
    // Keep the desktop spine aspect ratio in mobile while scaling both axes
    // together. The previous height mapping used a different scale factor,
    // making mobile books visibly shorter relative to their width.
    button.style.setProperty('--mobile-spine-height', `${Math.round(visualHeight * mobileSpineScale)}px`);
    button.style.setProperty('--mobile-spine-width', `${Math.round(visualWidth * mobileSpineScale)}px`);
    const bookRowIndex = Math.floor(visualIndex / booksPerShelf);
    const bookColumnIndex = visualIndex % booksPerShelf;
    button.style.setProperty('--shelf-book-delay', `${90 + bookRowIndex * 140 + bookColumnIndex * 45}ms`);
    button.style.setProperty(
      '--spine-color',
      book.spineImage ? '#000000' : (book.spineColor || '#000000')
    );
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
    const wasOpen = modal.classList.contains('open');
    clearTimeout(popupCloseTimer);
    modal.classList.remove('closing-fade', 'close-immediate');
    modal.querySelector('.open-book').style.removeProperty('transform');
    selectedBook = book;
    setManagedImage(document.getElementById('popup-cover-img'), getPopupCoverSource(book));
    const conceptLabel = book.concept || '페어명';
    document.getElementById('popup-project-label').textContent = conceptLabel;
    document.getElementById('popup-project-label-banner').textContent = conceptLabel;
    document.getElementById('popup-characters-row').textContent =
      (book.participatingCharacters || []).join('  X  ') || '캐릭터 이름 X 캐릭터 이름';
    document.querySelector('#popup-book-subtitle .popup-english-track').textContent =
      book.subtitle || 'Once Upon a Time';
    document.getElementById('popup-book-title').textContent = book.title;
    const popupDescription = document.getElementById('popup-book-desc');
    const popupDescriptionText =
      book.description || `${book.title}의 인물들이 수랑고에서 만나 새롭게 써 내려가는 이야기입니다.`;
    popupDescription.dataset.fullText = popupDescriptionText;
    popupDescription.textContent = popupDescriptionText;
    if (book.detailBgImage) preloadDetailImage(book.detailBgImage);
    updatePopupScale();
    modal.classList.add('open');
    if (!wasOpen) {
      bookPopupSfx.currentTime = 0;
      bookPopupSfx.play().catch(() => {});
    }
    requestAnimationFrame(updatePopupTypography);
    document.getElementById('btn-close-popup').focus();
  }

  function getPopupCoverSource(book) {
    if (popupMobileMedia.matches) {
      return book.mobileCoverImage || book.coverImage || '';
    }
    return book.coverImage || book.mobileCoverImage || '';
  }

  function preloadPopupCoverSource(source) {
    if (!source) return Promise.resolve(false);
    if (popupCoverPreloads.has(source)) return popupCoverPreloads.get(source);

    const preload = new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        resolve(loaded);
      };
      image.decoding = 'async';
      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().then(() => finish(true), () => finish(true));
        } else finish(true);
      };
      image.onerror = () => finish(false);
      image.src = source;
      if (image.complete) finish(image.naturalWidth > 0);
    });

    popupCoverPreloads.set(source, preload);
    preload.then((loaded) => {
      if (!loaded && popupCoverPreloads.get(source) === preload) {
        popupCoverPreloads.delete(source);
      }
    });
    return preload;
  }

  async function preloadPopupCoverQueue(sources, concurrency) {
    const queue = [...new Set(sources.filter(Boolean))];
    let nextIndex = 0;
    async function worker() {
      while (nextIndex < queue.length) {
        const source = queue[nextIndex];
        nextIndex += 1;
        await preloadPopupCoverSource(source);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
    );
  }

  async function preloadAllPopupCovers() {
    const books = activeBooks();
    const preferredSources = books.map(getPopupCoverSource);
    const alternateSources = books.flatMap((book) => (
      popupMobileMedia.matches
        ? [book.coverImage]
        : [book.mobileCoverImage]
    ));
    await preloadPopupCoverQueue(preferredSources, 2);
    await preloadPopupCoverQueue(alternateSources, 1);
  }

  function schedulePopupCoverPreload() {
    if (popupCoverPreloadScheduled) {
      popupCoverPreloadReschedule = true;
      return;
    }
    popupCoverPreloadScheduled = true;
    const run = async () => {
      try {
        await preloadAllPopupCovers();
      } finally {
        popupCoverPreloadScheduled = false;
        if (popupCoverPreloadReschedule) {
          popupCoverPreloadReschedule = false;
          schedulePopupCoverPreload();
        }
      }
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => void run(), { timeout: 2500 });
    } else {
      window.setTimeout(() => void run(), 900);
    }
  }

  function updatePopupTypography() {
    const subtitle = document.getElementById('popup-book-subtitle');
    const subtitleTrack = subtitle.querySelector('.popup-english-track');
    const characters = document.getElementById('popup-characters-row');
    const title = document.getElementById('popup-book-title');

    subtitle.classList.remove('is-overflowing');
    subtitle.style.removeProperty('--popup-subtitle-shift');
    subtitle.style.removeProperty('--popup-subtitle-duration');
    subtitleTrack.classList.remove('is-looping');
    subtitleTrack.removeAttribute('data-marquee-text');
    characters.style.removeProperty('font-size');
    title.style.removeProperty('font-size');

    const charactersBaseSize = Number.parseFloat(getComputedStyle(characters).fontSize) || 12;
    if (characters.scrollWidth > characters.clientWidth) {
      const fittedSize = Math.max(
        8,
        Math.floor(charactersBaseSize * characters.clientWidth / characters.scrollWidth * 10) / 10
      );
      characters.style.fontSize = `${fittedSize}px`;
    }

    const titleBaseSize = Number.parseFloat(getComputedStyle(title).fontSize) || 36;
    if (title.scrollWidth > title.clientWidth) {
      const fittedSize = Math.max(18, Math.floor(titleBaseSize * title.clientWidth / title.scrollWidth * 10) / 10);
      title.style.fontSize = `${fittedSize}px`;
    }

    const subtitleOverflow = Math.ceil(subtitleTrack.scrollWidth - subtitle.clientWidth);
    if (subtitleOverflow > 0) {
      subtitleTrack.setAttribute('data-marquee-text', subtitleTrack.textContent || '');
      subtitleTrack.classList.add('is-looping');
      subtitle.style.setProperty('--popup-subtitle-shift', `${subtitleOverflow}px`);
      subtitle.style.setProperty('--popup-subtitle-duration', `${Math.min(14, Math.max(7, 5 + subtitleOverflow / 36))}s`);
      subtitle.classList.add('is-overflowing');
    }

    updatePopupDescriptionOverflow();
  }

  function updatePopupDescriptionOverflow() {
    const description = document.getElementById('popup-book-desc');
    const fullText = description.dataset.fullText || description.textContent || '';
    description.textContent = fullText;

    if (!popupMobileMedia.matches || description.scrollHeight <= description.clientHeight + 1) return;

    let low = 0;
    let high = fullText.length;
    let fittedText = '...';
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = `${fullText.slice(0, middle).trimEnd()}...`;
      description.textContent = candidate;
      if (description.scrollHeight <= description.clientHeight + 1) {
        fittedText = candidate;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    description.textContent = fittedText;
  }

  function closeBook({ animate = false } = {}) {
    if (!modal.classList.contains('open')) return;
    clearTimeout(popupCloseTimer);
    if (animate) {
      modal.classList.remove('close-immediate');
      modal.classList.add('closing-fade');
      popupCloseTimer = window.setTimeout(() => {
        modal.classList.add('close-immediate');
        modal.classList.remove('open', 'closing-fade');
        requestAnimationFrame(() => modal.classList.remove('close-immediate'));
      }, 300);
      return;
    }
    modal.classList.add('close-immediate');
    modal.classList.remove('open', 'closing-fade');
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
    const particleTimeScale = 0.5;
    const renderInterval = 1000 / 30;
    let canvasLayoutVersion = 0;
    let previousTime = performance.now();

    window.addEventListener('resize', () => {
      canvasLayoutVersion += 1;
    }, { passive: true });

    function createStarSprite(mote) {
      const padding = 2;
      const size = Math.ceil(mote.glow * 2 + padding * 2);
      const center = size / 2;
      const sprite = document.createElement('canvas');
      sprite.width = size;
      sprite.height = size;
      const context = sprite.getContext('2d');
      const [red, green, blue] = mote.color;
      const gradient = context.createRadialGradient(center, center, 0, center, center, mote.glow);
      gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 1)`);
      gradient.addColorStop(0.24, `rgba(${red}, ${green}, ${blue}, 0.42)`);
      gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(center, center, mote.glow, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.beginPath();
      context.arc(center, center, mote.radius, 0, Math.PI * 2);
      context.fill();

      if (mote.hasRays) {
        const ray = mote.glow * 0.75;
        context.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.42)`;
        context.lineWidth = 0.6;
        context.beginPath();
        context.moveTo(center - ray, center);
        context.lineTo(center + ray, center);
        context.moveTo(center, center - ray);
        context.lineTo(center, center + ray);
        context.stroke();
      }
      return sprite;
    }

    function createMotes(width, height) {
      const count = width < 768 ? 34 : 60;
      const colors = [
        [255, 246, 224],
        [255, 230, 190],
        [255, 211, 211],
        [210, 221, 255]
      ];
      return Array.from({ length: count }, () => {
        const mote = {
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 0.7 + Math.random() * 1.7,
          glow: 4 + Math.random() * 8,
          speed: 2 + Math.random() * 3,
          drift: 2 + Math.random() * 7,
          alpha: 0.18 + Math.random() * 0.34,
          phase: Math.random() * Math.PI * 2,
          twinkle: 0.5 + Math.random() * 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          hasRays: Math.random() < 0.18
        };
        mote.sprite = createStarSprite(mote);
        return mote;
      });
    }

    function prepareCanvas(canvas) {
      if (!canvas.closest('.view-section')?.classList.contains('active')) return null;
      let state = canvasStates.get(canvas);
      if (state?.layoutVersion === canvasLayoutVersion) return state;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const ratio = Math.min(1.25, window.devicePixelRatio || 1);
      if (!state || state.width !== rect.width || state.height !== rect.height || state.ratio !== ratio) {
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        state = {
          width: rect.width,
          height: rect.height,
          ratio,
          motes: createMotes(rect.width, rect.height),
          context: canvas.getContext('2d'),
          layoutVersion: canvasLayoutVersion
        };
        canvasStates.set(canvas, state);
      } else {
        state.layoutVersion = canvasLayoutVersion;
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
      if (!canvas.closest('.view-section')?.classList.contains('active')) return null;
      let state = sunBokehStates.get(canvas);
      if (state?.layoutVersion === canvasLayoutVersion) return state;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const ratio = Math.min(1.25, window.devicePixelRatio || 1);
      if (!state || state.width !== rect.width || state.height !== rect.height || state.ratio !== ratio) {
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        state = {
          width: rect.width,
          height: rect.height,
          ratio,
          bokeh: createSunBokeh(rect.width, rect.height),
          context: canvas.getContext('2d'),
          layoutVersion: canvasLayoutVersion
        };
        sunBokehStates.set(canvas, state);
      } else {
        state.layoutVersion = canvasLayoutVersion;
      }
      return state;
    }

    function drawSunBokeh(canvas, state, time) {
      const context = state.context;
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
      const context = state.context;
      context.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
      context.clearRect(0, 0, state.width, state.height);
      context.globalCompositeOperation = 'lighter';

      state.motes.forEach((mote) => {
        mote.y -= mote.speed * delta * motionScale * particleTimeScale;
        if (mote.y < -mote.glow) {
          mote.y = state.height + mote.glow;
          mote.x = Math.random() * state.width;
        }
        const particleTime = time * particleTimeScale;
        const x = mote.x + Math.sin(particleTime * 0.00018 + mote.phase) * mote.drift * motionScale;
        const y = mote.y + Math.cos(particleTime * 0.00013 + mote.phase) * 4 * motionScale;
        const cycle = particleTime * 0.001 * Math.PI * 2 / mote.twinkle * motionScale + mote.phase;
        const pulse = 0.16 + Math.pow((Math.sin(cycle) + 1) / 2, 2.4) * 0.84;
        context.globalAlpha = mote.alpha * (0.3 + pulse * 0.7);
        context.drawImage(
          mote.sprite,
          Math.round(x - mote.sprite.width / 2),
          Math.round(y - mote.sprite.height / 2)
        );
      });
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
    }

    function animate(time) {
      requestAnimationFrame(animate);
      if (document.hidden || time - previousTime < renderInterval) return;
      const delta = Math.min(0.08, (time - previousTime) / 1000);
      previousTime = time;
      canvases.forEach((canvas) => {
        const state = prepareCanvas(canvas);
        if (state) drawCanvas(canvas, state, time, delta);
      });
      sunBokehCanvases.forEach((canvas) => {
        const state = prepareSunBokehCanvas(canvas);
        if (state) drawSunBokeh(canvas, state, time);
      });
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
    const image = book.detailBgImage || '';
    if (image) await preloadDetailImage(image);
    if (renderSequence !== detailRenderSequence || selectedBook?.id !== book.id) return;
    if (!detailWasActive && !modal.classList.contains('open')) return;
    const detailImage = document.getElementById('detail-bg-img');
    const backdropImage = document.getElementById('detail-backdrop-img');
    setManagedImage(detailImage, image);
    setManagedImage(backdropImage, image);

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
      const bubbleText = document.createElement('span');
      bubbleText.className = 'story-bubble-text';
      bubbleText.textContent = quote.text;
      bubble.appendChild(bubbleText);
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
    // Replace the shelf underneath the still-open popup. Keeping the popup as
    // a visual cover prevents a shelf frame from flashing between both views.
    showView('detail', { instant: true });
    updateBubbleLayout();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => closeBook({ animate: true }));
    });
  }

  function updateUiVisibility() {
    const uiLayer = document.getElementById('detail-ui-layer');
    uiLayer.classList.toggle('hidden', !uiVisible);
    uiLayer.inert = !uiVisible;
    uiLayer.setAttribute('aria-hidden', String(!uiVisible));
    const toggle = document.getElementById('btn-ui-toggle');
    toggle.setAttribute('aria-pressed', String(uiVisible));
    toggle.setAttribute('aria-label', uiVisible ? 'UI 숨기기' : 'UI 보기');
    toggle.title = uiVisible ? 'UI 숨기기' : 'UI 보기';
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

  function updateBgmCopyright(value) {
    bgmCopyright = typeof value === 'string' ? value.trim() : DEFAULT_BGM_COPYRIGHT;
    bgmWidgets.forEach((button) => {
      if (bgmCopyright) {
        button.dataset.bgmCopyright = bgmCopyright;
        button.setAttribute('aria-description', bgmCopyright);
      } else {
        delete button.dataset.bgmCopyright;
        button.removeAttribute('aria-description');
      }
    });
  }

  async function loadHomepageBgm(settings = null) {
    const currentSettings = settings || getSiteSettings();
    updateBgmCopyright(currentSettings.bgmCopyright);
    const nextName = String(currentSettings.bgmName || '');
    const nextUpdatedAt = Number(currentSettings.bgmUpdatedAt) || 0;
    if (settings && nextName === bgmName && nextUpdatedAt === bgmUpdatedAt) return;

    const sequence = ++bgmLoadSequence;
    try {
      const bgm = await getHomepageBgm({ stream: true });
      if (sequence !== bgmLoadSequence) return;
      updateBgmCopyright(bgm.bgmCopyright);

      const loadedName = String(bgm.bgmName || '');
      const loadedUpdatedAt = Number(bgm.bgmUpdatedAt) || 0;
      if (bgmAudio.src && loadedName === bgmName && loadedUpdatedAt === bgmUpdatedAt) return;

      if (bgmObjectUrl) URL.revokeObjectURL(bgmObjectUrl);
      bgmObjectUrl = '';
      bgmName = loadedName;
      bgmUpdatedAt = loadedUpdatedAt;
      if (!bgm.url && !bgm.blob) {
        bgmAutoplayPending = false;
        bgmAudio.removeAttribute('src');
        bgmAudio.load();
        updateBgmWidgets();
        return;
      }
      if (bgm.url) {
        bgmAudio.src = bgm.url;
      } else {
        bgmObjectUrl = URL.createObjectURL(bgm.blob);
        bgmAudio.src = bgmObjectUrl;
      }
      bgmAudio.autoplay = true;
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
    // A previous popup close can still have a pending animation timer when the
    // user returns home and immediately starts again. Clear it before showing
    // the shelf so a stale selected book cannot reappear over the new view.
    dismissBookPopupForNavigation();
    showView('bookshelf');
  });
  document.getElementById('header-logo-home').addEventListener('click', () => {
    dismissBookPopupForNavigation();
    showView('intro');
  });
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
  bgmAudio.addEventListener('canplay', () => {
    if (document.body.dataset.view === 'intro' && bgmPlayRequested && bgmAudio.paused) {
      tryPlayBgm();
    }
  });
  function retryBlockedAutoplay(event) {
    if (event?.target?.closest?.('.site-bgm-widget')) return;
    if (bgmAutoplayPending && bgmPlayRequested && bgmAudio.paused) tryPlayBgm();
  }

  document.addEventListener('pointerdown', retryBlockedAutoplay);
  document.addEventListener('keydown', retryBlockedAutoplay);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && bgmPlayRequested && bgmAudio.paused) tryPlayBgm();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) resetTransientNavigationState();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && detailLandscape) setDetailLandscape(false, { exitFullscreen: false });
  });
  window.addEventListener('resize', () => {
    updateIntroBookScale();
    updatePopupScale();
    if (modal.classList.contains('open')) {
      if (selectedBook) setManagedImage(document.getElementById('popup-cover-img'), getPopupCoverSource(selectedBook));
      requestAnimationFrame(updatePopupTypography);
    }
    updateBubbleLayout();
  });
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
  schedulePopupCoverPreload();
  startAmbientParticles();
  document.body.dataset.view = 'intro';
  updateOrientationButton();
  loadHomepageBgm();
  subscribeSiteSettings(loadHomepageBgm);
  subscribeBooks(() => {
    renderBookshelf();
    schedulePopupCoverPreload();
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
