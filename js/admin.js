document.addEventListener('DOMContentLoaded', async () => {
  await initializeSurangData({ allowLocalSeed: true });
  const SESSION_KEY = 'surang_admin_session_v2';
  const PAGE_SIZE = 5;
  const loginView = document.getElementById('login-view');
  const adminShell = document.getElementById('admin-shell');
  const dashboardView = document.getElementById('dashboard-view');
  const detailEditorView = document.getElementById('detail-editor-view');
  const settingsView = document.getElementById('settings-view');
  const bookInspector = document.getElementById('book-inspector');
  const bookForm = document.getElementById('book-form');
  const toast = document.getElementById('admin-toast');

  let currentPage = 1;
  let selectedBookId = null;
  let editorBook = null;
  let characters = [];
  let spineImage = '';
  let coverImage = '';
  let mobileCoverImage = '';
  let detailBgImage = '';
  let pendingBookAssets = {
    spineImage: null,
    coverImage: null,
    mobileCoverImage: null,
    detailBgImage: null
  };
  let editorQuotes = [];
  let selectedQuoteId = null;
  let toastTimer = null;
  let draggedQuoteId = null;
  let pendingBgmFile = null;
  let bgmPreviewUrl = '';
  let detailPreviewImageSize = { width: BUBBLE_REFERENCE_WIDTH, height: BUBBLE_REFERENCE_HEIGHT };
  let detailPreviewImageLoadToken = 0;

  const field = (id) => document.getElementById(id);

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  window.addEventListener('surang:data-sync-error', () => {
    showToast('서버 저장에 실패했습니다. 실행 중인 데이터 서버를 확인해 주세요.');
  });

  function openSession() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    loginView.hidden = true;
    adminShell.hidden = false;
    const firstBook = getBooks()[0];
    selectedBookId = firstBook?.id || null;
    renderDashboard();
    if (firstBook) loadBookIntoForm(firstBook);
    else resetBookForm();
    refreshBgmSettings();
  }

  function closeSession() {
    sessionStorage.removeItem(SESSION_KEY);
    adminShell.hidden = true;
    loginView.hidden = false;
    field('login-password').value = '';
    field('login-error').textContent = '';
  }

  field('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const id = field('login-id').value.trim();
    const password = field('login-password').value;
    if (['admin', 'manager_clara'].includes(id) && password === 'surang1234') {
      openSession();
      return;
    }
    field('login-error').textContent = '아이디 또는 비밀번호를 다시 확인해 주세요.';
  });

  field('password-toggle').addEventListener('click', () => {
    const password = field('login-password');
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    field('password-toggle').setAttribute('aria-label', visible ? '비밀번호 보기' : '비밀번호 숨기기');
  });
  field('logout-button').addEventListener('click', closeSession);

  function filteredBooks() {
    const query = field('book-search').value.trim().toLowerCase();
    const status = field('status-filter').value;
    return getBooks().filter((book) => {
      const searchable = [
        book.title,
        book.subtitle,
        ...(book.participatingCharacters || [])
      ].join(' ').toLowerCase();
      const matchesQuery = !query || searchable.includes(query);
      const matchesStatus = status === 'all' || book.status === status;
      return matchesQuery && matchesStatus;
    });
  }

  function renderDashboard() {
    const books = filteredBooks();
    const totalPages = Math.max(1, Math.ceil(books.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const pageBooks = books.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const body = field('book-table-body');
    body.replaceChildren();

    pageBooks.forEach((book) => {
      const row = document.createElement('tr');
      row.classList.toggle('selected', book.id === selectedBookId);
      row.dataset.bookId = book.id;

      const bookCell = document.createElement('td');
      const bookWrap = document.createElement('div');
      bookWrap.className = 'book-cell';
      const thumb = document.createElement('span');
      thumb.className = 'book-thumb';
      thumb.style.setProperty('--book-color', book.spineColor || '#6d4f3d');
      if (book.spineImage) thumb.style.backgroundImage = `url("${book.spineImage}")`;
      const titles = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = book.title;
      const subtitle = document.createElement('small');
      subtitle.textContent = book.subtitle || book.title;
      titles.append(title, subtitle);
      bookWrap.append(thumb, titles);
      bookCell.appendChild(bookWrap);

      const conceptCell = document.createElement('td');
      conceptCell.textContent = book.concept || '미지정';

      const characterCell = document.createElement('td');
      const characterSummary = document.createElement('span');
      characterSummary.className = 'character-summary';
      characterSummary.textContent = (book.participatingCharacters || []).join(', ') || '미등록';
      characterCell.appendChild(characterSummary);

      const statusCell = document.createElement('td');
      const statusButton = document.createElement('button');
      statusButton.type = 'button';
      statusButton.className = `status-button${book.status === 'active' ? '' : ' draft'}`;
      statusButton.textContent = book.status === 'active' ? '공개' : '비공개';
      statusButton.addEventListener('click', (event) => {
        event.stopPropagation();
        updateBook({ ...book, status: book.status === 'active' ? 'draft' : 'active' });
        renderDashboard();
        showToast('공개 상태를 변경했습니다.');
      });
      statusCell.appendChild(statusButton);

      const actionCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.setAttribute('aria-label', `${book.title} 편집`);
      editButton.innerHTML = '<img src="assets/figma/admin-pencil.svg" alt="">';
      editButton.addEventListener('click', (event) => {
        event.stopPropagation();
        selectBook(book.id);
      });
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-row';
      deleteButton.setAttribute('aria-label', `${book.title} 삭제`);
      deleteButton.innerHTML = '<img src="assets/figma/admin-x.svg" alt="">';
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!window.confirm(`“${book.title}”을(를) 책장에서 삭제할까요?`)) return;
        deleteBook(book.id);
        if (selectedBookId === book.id) {
          selectedBookId = getBooks()[0]?.id || null;
          if (selectedBookId) loadBookIntoForm(getBookById(selectedBookId));
          else resetBookForm();
        }
        renderDashboard();
        showToast('책을 삭제했습니다.');
      });
      actions.append(editButton, deleteButton);
      actionCell.appendChild(actions);

      row.append(bookCell, conceptCell, characterCell, statusCell, actionCell);
      row.addEventListener('click', () => selectBook(book.id));
      body.appendChild(row);
    });

    field('empty-books').hidden = books.length !== 0;
    field('book-count').textContent = books.length;
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const pagination = field('pagination');
    pagination.replaceChildren();

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.disabled = currentPage === 1;
    previous.setAttribute('aria-label', '이전 페이지');
    previous.innerHTML = '<img src="assets/figma/admin-chevron-left.svg" alt="">';
    previous.addEventListener('click', () => {
      currentPage -= 1;
      renderDashboard();
    });
    pagination.appendChild(previous);

    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = page;
      button.classList.toggle('active', page === currentPage);
      button.addEventListener('click', () => {
        currentPage = page;
        renderDashboard();
      });
      pagination.appendChild(button);
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.disabled = currentPage === totalPages;
    next.setAttribute('aria-label', '다음 페이지');
    next.innerHTML = '<img src="assets/figma/admin-chevron-right.svg" alt="">';
    next.addEventListener('click', () => {
      currentPage += 1;
      renderDashboard();
    });
    pagination.appendChild(next);
  }

  function selectBook(id) {
    const book = getBookById(id);
    if (!book) return;
    selectedBookId = id;
    bookInspector.classList.remove('closed');
    loadBookIntoForm(book);
    renderDashboard();
  }

  function renderCharacterChips() {
    const container = field('character-chips');
    container.replaceChildren();
    characters.forEach((character, index) => {
      const chip = document.createElement('span');
      chip.className = 'character-chip';
      chip.append(document.createTextNode(character));
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = '×';
      removeButton.setAttribute('aria-label', `${character} 삭제`);
      removeButton.addEventListener('click', () => {
        characters.splice(index, 1);
        renderCharacterChips();
      });
      chip.appendChild(removeButton);
      container.appendChild(chip);
    });
  }

  function setUploadPreview(id, image) {
    const preview = field(id);
    preview.classList.toggle('has-image', Boolean(image));
    preview.style.backgroundImage = image ? `url("${image}")` : '';
    const small = preview.querySelector('small');
    if (small) small.textContent = image ? '이미지 변경' : '이미지 업로드';
  }

  function loadBookIntoForm(book) {
    pendingBookAssets = { spineImage: null, coverImage: null, mobileCoverImage: null, detailBgImage: null };
    field('book-id').value = book.id;
    field('book-title').value = book.title || '';
    field('book-subtitle').value = book.subtitle || '';
    field('book-concept').value = book.concept || '세계 명작';
    field('book-contact').value = book.contact || '';
    field('book-description').value = book.description || '';
    field('book-spine-color').value = book.spineColor || '#6d4f3d';
    field('book-spine-color-text').value = (book.spineColor || '#6D4F3D').toUpperCase();
    field('book-spine-height').value = book.spineHeight || 230;
    field('book-spine-width').value = book.spineWidth || 60;
    characters = [...(book.participatingCharacters || [])];
    spineImage = book.spineImage || '';
    coverImage = book.coverImage || '';
    mobileCoverImage = book.mobileCoverImage || '';
    detailBgImage = book.detailBgImage || '';
    renderCharacterChips();
    setUploadPreview('spine-preview', spineImage);
    setUploadPreview('cover-preview', coverImage);
    setUploadPreview('mobile-cover-preview', mobileCoverImage);
    setUploadPreview('detail-preview', detailBgImage);
    field('spine-upload').value = '';
    field('cover-upload').value = '';
    field('mobile-cover-upload').value = '';
    field('detail-upload').value = '';
    field('inspector-heading').textContent = '도서 상세 편집';
  }

  function resetBookForm() {
    bookForm.reset();
    field('book-id').value = '';
    field('book-spine-color').value = '#6d4f3d';
    field('book-spine-color-text').value = '#6D4F3D';
    field('book-spine-height').value = getAutomaticSpineHeight(getBooks().length);
    field('book-spine-width').value = 60;
    characters = [];
    spineImage = '';
    coverImage = '';
    mobileCoverImage = '';
    detailBgImage = '';
    pendingBookAssets = { spineImage: null, coverImage: null, mobileCoverImage: null, detailBgImage: null };
    renderCharacterChips();
    setUploadPreview('spine-preview', spineImage);
    setUploadPreview('cover-preview', coverImage);
    setUploadPreview('mobile-cover-preview', mobileCoverImage);
    setUploadPreview('detail-preview', detailBgImage);
    field('inspector-heading').textContent = '새로운 책 등록';
  }

  field('character-input').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    const name = event.currentTarget.value.trim().replace(/,$/, '');
    if (name && !characters.includes(name)) {
      characters.push(name);
      renderCharacterChips();
    }
    event.currentTarget.value = '';
  });

  function bindColorPair(colorId, textId, onChange) {
    const colorInput = field(colorId);
    const textInput = field(textId);
    colorInput.addEventListener('input', () => {
      textInput.value = colorInput.value.toUpperCase();
      onChange?.();
    });
    textInput.addEventListener('change', () => {
      const value = textInput.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        colorInput.value = value;
        textInput.value = value.toUpperCase();
        onChange?.();
      } else {
        textInput.value = colorInput.value.toUpperCase();
      }
    });
  }

  bindColorPair('book-spine-color', 'book-spine-color-text');

  function bindUpload(inputId, previewId, fieldName) {
    field(inputId).addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        event.target.value = '';
        showToast('이미지 파일만 업로드할 수 있습니다.');
        return;
      }
      if (file.size > MAX_BOOK_IMAGE_SIZE) {
        event.target.value = '';
        showToast('이미지는 파일당 15MB 이하만 업로드할 수 있습니다.');
        return;
      }
      pendingBookAssets[fieldName] = file;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setUploadPreview(previewId, String(reader.result));
      });
      reader.addEventListener('error', () => {
        pendingBookAssets[fieldName] = null;
        event.target.value = '';
        showToast('이미지 미리보기를 불러오지 못했습니다.');
      });
      reader.readAsDataURL(file);
    });
  }

  bindUpload('spine-upload', 'spine-preview', 'spineImage');
  bindUpload('cover-upload', 'cover-preview', 'coverImage');
  bindUpload('mobile-cover-upload', 'mobile-cover-preview', 'mobileCoverImage');
  bindUpload('detail-upload', 'detail-preview', 'detailBgImage');

  function formBookData(existing) {
    return {
      ...(existing || {}),
      id: field('book-id').value || undefined,
      title: field('book-title').value.trim(),
      subtitle: field('book-subtitle').value.trim(),
      concept: field('book-concept').value,
      contact: field('book-contact').value.trim(),
      description: field('book-description').value.trim(),
      participatingCharacters: characters,
      spineColor: field('book-spine-color').value,
      spineHeight: Number(field('book-spine-height').value) || getAutomaticSpineHeight(getBooks().length),
      spineWidth: Number(field('book-spine-width').value) || 60,
      status: existing?.status || 'active',
      spineImage: pendingBookAssets.spineImage || spineImage,
      coverImage: pendingBookAssets.coverImage || coverImage,
      mobileCoverImage: pendingBookAssets.mobileCoverImage || mobileCoverImage,
      detailBgImage: pendingBookAssets.detailBgImage || detailBgImage,
      quotes: existing?.quotes || []
    };
  }

  bookForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = field('book-id').value;
    const existing = id ? getBookById(id) : null;
    const data = formBookData(existing);
    const submitButton = event.submitter || bookForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    bookForm.setAttribute('aria-busy', 'true');
    try {
      const saved = await saveBookWithAssets(data);
      selectedBookId = saved.id;
      loadBookIntoForm(saved);
      renderDashboard();
      showToast(existing ? '책 정보와 이미지를 저장했습니다.' : '새로운 책을 등록했습니다.');
    } catch (error) {
      console.error('책 저장 실패', error);
      showToast(error?.message || '책 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      submitButton.disabled = false;
      bookForm.removeAttribute('aria-busy');
    }
  });

  field('new-book-button').addEventListener('click', () => {
    selectedBookId = null;
    bookInspector.classList.remove('closed');
    resetBookForm();
    renderDashboard();
    field('book-title').focus();
  });
  field('cancel-book-button').addEventListener('click', () => {
    const book = selectedBookId ? getBookById(selectedBookId) : getBooks()[0];
    if (book) {
      selectedBookId = book.id;
      loadBookIntoForm(book);
      renderDashboard();
    }
  });
  field('inspector-close').addEventListener('click', () => bookInspector.classList.add('closed'));
  field('book-search').addEventListener('input', () => {
    currentPage = 1;
    renderDashboard();
  });
  field('status-filter').addEventListener('change', () => {
    currentPage = 1;
    renderDashboard();
  });

  document.querySelectorAll('.sidebar-nav button').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      if (section === 'dashboard' || section === 'books') {
        document.querySelectorAll('.sidebar-nav button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        showDashboard();
      } else if (section === 'settings') {
        document.querySelectorAll('.sidebar-nav button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        showSettings();
      } else {
        showToast('방명록 보관소는 준비 중입니다.');
      }
    });
  });

  function showDashboard() {
    detailEditorView.hidden = true;
    settingsView.hidden = true;
    dashboardView.hidden = false;
    renderDashboard();
  }

  function showSettings() {
    dashboardView.hidden = true;
    detailEditorView.hidden = true;
    settingsView.hidden = false;
    refreshBgmSettings();
  }

  function openDetailEditor() {
    const id = field('book-id').value;
    if (!id) {
      showToast('책을 먼저 등록한 뒤 상세 화면을 편집해 주세요.');
      return;
    }
    editorBook = getBookById(id);
    if (!editorBook) return;
    editorQuotes = cloneQuotes(editorBook.quotes || []);
    selectedQuoteId = editorQuotes[0]?.id || null;
    field('detail-editor-book-title').textContent = editorBook.title;
    const detailImageSource = editorBook.detailBgImage || FIGMA_DETAIL;
    field('detail-preview-image').style.backgroundImage = `url("${detailImageSource}")`;
    detailPreviewImageSize = { width: BUBBLE_REFERENCE_WIDTH, height: BUBBLE_REFERENCE_HEIGHT };
    const imageLoadToken = ++detailPreviewImageLoadToken;
    const previewImage = new Image();
    previewImage.addEventListener('load', () => {
      if (imageLoadToken !== detailPreviewImageLoadToken) return;
      detailPreviewImageSize = {
        width: previewImage.naturalWidth || BUBBLE_REFERENCE_WIDTH,
        height: previewImage.naturalHeight || BUBBLE_REFERENCE_HEIGHT
      };
      renderPreviewBubbles();
    });
    previewImage.src = detailImageSource;
    dashboardView.hidden = true;
    settingsView.hidden = true;
    detailEditorView.hidden = false;
    renderQuoteEditor();
    syncBubbleStyleControls();
  }

  function cloneQuotes(quotes) {
    return JSON.parse(JSON.stringify(quotes));
  }

  function renderQuoteEditor() {
    const list = field('quote-list');
    list.replaceChildren();
    editorQuotes.forEach((quote) => {
      const item = document.createElement('div');
      item.className = `quote-item${quote.id === selectedQuoteId ? ' selected' : ''}`;
      item.draggable = true;
      item.dataset.quoteId = quote.id;

      const grip = document.createElement('img');
      grip.className = 'quote-grip';
      grip.src = 'assets/figma/admin-grip.svg';
      grip.alt = '';

      const text = document.createElement('textarea');
      text.value = quote.text;
      text.setAttribute('aria-label', '대사 내용');
      text.addEventListener('focus', () => selectQuote(quote.id));
      text.addEventListener('input', () => {
        quote.text = text.value;
        renderPreviewBubbles();
      });

      const tails = document.createElement('div');
      tails.className = 'tail-options';
      ['L', 'C', 'R'].forEach((tail) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = tail;
        button.classList.toggle('active', quote.tail === tail);
        button.setAttribute('aria-label', `말풍선 꼬리 ${tail}`);
        button.addEventListener('click', () => {
          quote.tail = tail;
          selectedQuoteId = quote.id;
          renderQuoteEditor();
          syncBubbleStyleControls();
        });
        tails.appendChild(button);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-quote';
      remove.setAttribute('aria-label', '대사 삭제');
      remove.innerHTML = '<img src="assets/figma/admin-x.svg" alt="">';
      remove.addEventListener('click', () => {
        editorQuotes = editorQuotes.filter((itemQuote) => itemQuote.id !== quote.id);
        selectedQuoteId = editorQuotes[0]?.id || null;
        renderQuoteEditor();
        syncBubbleStyleControls();
      });

      item.addEventListener('click', () => selectQuote(quote.id));
      item.addEventListener('dragstart', () => {
        draggedQuoteId = quote.id;
      });
      item.addEventListener('dragover', (event) => event.preventDefault());
      item.addEventListener('drop', (event) => {
        event.preventDefault();
        if (!draggedQuoteId || draggedQuoteId === quote.id) return;
        const fromIndex = editorQuotes.findIndex((entry) => entry.id === draggedQuoteId);
        const toIndex = editorQuotes.findIndex((entry) => entry.id === quote.id);
        const [moved] = editorQuotes.splice(fromIndex, 1);
        editorQuotes.splice(toIndex, 0, moved);
        draggedQuoteId = null;
        renderQuoteEditor();
      });

      item.append(grip, text, tails, remove);
      list.appendChild(item);
    });
    field('quote-count').textContent = `${editorQuotes.length} / 8`;
    field('add-quote-button').disabled = editorQuotes.length >= 8;
    renderPreviewBubbles();
  }

  function selectQuote(id) {
    if (selectedQuoteId === id) {
      syncBubbleStyleControls();
      return;
    }
    selectedQuoteId = id;
    document.querySelectorAll('.quote-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.quoteId === id);
    });
    renderPreviewBubbles();
    syncBubbleStyleControls();
  }

  function renderPreviewBubbles() {
    const container = field('detail-preview-bubbles');
    container.replaceChildren();
    editorQuotes.forEach((quote) => {
      const bubble = document.createElement('div');
      bubble.className = `preview-bubble tail-${quote.tail || 'C'}${quote.id === selectedQuoteId ? ' selected' : ''}`;
      bubble.dataset.quoteId = quote.id;
      const bubbleText = document.createElement('span');
      bubbleText.className = 'preview-bubble-text';
      bubbleText.textContent = quote.text || '대사를 입력하세요.';
      bubble.appendChild(bubbleText);
      const bubbleColor = quote.bubbleColor || DEFAULT_BUBBLE_STYLE.color;
      const bubbleOpacity = Number(quote.bubbleOpacity ?? DEFAULT_BUBBLE_STYLE.opacity);
      const bubbleBackground = rgbaFromHex(bubbleColor, bubbleOpacity);
      bubble.style.setProperty('--bubble-background', bubbleBackground);
      bubble.style.setProperty('--bubble-tail-background', bubbleBackground);
      if (quote.id === selectedQuoteId) {
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((position) => {
          const handle = document.createElement('i');
          handle.className = `selection-handle ${position}`;
          handle.setAttribute('aria-hidden', 'true');
          bubble.appendChild(handle);
        });
      }
      bubble.addEventListener('pointerdown', (event) => startBubbleDrag(event, quote));
      bubble.addEventListener('click', () => selectQuote(quote.id));
      container.appendChild(bubble);
    });
    requestAnimationFrame(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      editorQuotes.forEach((quote) => {
        const bubble = container.querySelector(`[data-quote-id="${CSS.escape(quote.id)}"]`);
        if (!bubble) return;
        const projectedPoint = projectBubblePointToFrame(
          Number(quote.x),
          Number(quote.y),
          quote.positionSpace,
          detailPreviewImageSize.width,
          detailPreviewImageSize.height,
          width,
          height
        );
        bubble.style.left = `${Math.max(2, Math.min(width - bubble.offsetWidth - 2, projectedPoint.left))}px`;
        bubble.style.top = `${Math.max(2, Math.min(height - bubble.offsetHeight - 5, projectedPoint.top))}px`;
      });
    });
  }

  function startBubbleDrag(event, quote) {
    event.preventDefault();
    event.stopPropagation();
    selectedQuoteId = quote.id;
    syncBubbleStyleControls();
    const canvas = field('detail-preview-canvas');
    const rect = canvas.getBoundingClientRect();
    const bubbleRect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - bubbleRect.left;
    const offsetY = event.clientY - bubbleRect.top;

    function move(pointerEvent) {
      const x = Math.max(0, Math.min(rect.width - bubbleRect.width, pointerEvent.clientX - rect.left - offsetX));
      const y = Math.max(0, Math.min(rect.height - bubbleRect.height, pointerEvent.clientY - rect.top - offsetY));
      const referencePoint = framePointToBubbleReference(
        x,
        y,
        detailPreviewImageSize.width,
        detailPreviewImageSize.height,
        rect.width,
        rect.height
      );
      quote.x = Math.round(Math.max(0, Math.min(BUBBLE_REFERENCE_WIDTH, referencePoint.x)));
      quote.y = Math.round(Math.max(0, Math.min(BUBBLE_REFERENCE_HEIGHT, referencePoint.y)));
      quote.positionSpace = BUBBLE_POSITION_SPACE;
      renderPreviewBubbles();
    }

    function stop() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      renderQuoteEditor();
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    renderPreviewBubbles();
  }

  field('add-quote-button').addEventListener('click', () => {
    if (editorQuotes.length >= 8) return;
    const quote = {
      id: `q-${Date.now()}`,
      text: '새로운 대사를 입력하세요.',
      tail: 'C',
      x: 827,
      y: 300 + editorQuotes.length * 64,
      positionSpace: BUBBLE_POSITION_SPACE,
      bubbleColor: DEFAULT_BUBBLE_STYLE.color,
      bubbleOpacity: DEFAULT_BUBBLE_STYLE.opacity
    };
    editorQuotes.push(quote);
    selectedQuoteId = quote.id;
    renderQuoteEditor();
    syncBubbleStyleControls();
  });

  function currentBubbleStyle() {
    return {
      color: field('bubble-color').value,
      opacity: Number(field('bubble-opacity').value)
    };
  }

  function rgbaFromHex(hex, opacity) {
    const normalized = String(hex || '#000000').replace('#', '').padEnd(6, '0');
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, Number(opacity) / 100))})`;
  }

  function selectedQuote() {
    return editorQuotes.find((quote) => quote.id === selectedQuoteId) || null;
  }

  function syncBubbleStyleControls() {
    const quote = selectedQuote();
    const color = quote?.bubbleColor || DEFAULT_BUBBLE_STYLE.color;
    const opacity = Number(quote?.bubbleOpacity ?? DEFAULT_BUBBLE_STYLE.opacity);
    field('bubble-color').value = color;
    field('bubble-color-text').value = color.toUpperCase();
    field('bubble-opacity').value = opacity;
    updateBubbleStylePreview();
  }

  function updateBubbleStylePreview() {
    const style = currentBubbleStyle();
    field('bubble-color-preview').style.background = rgbaFromHex(style.color, style.opacity);
    field('bubble-opacity-value').textContent = `${style.opacity}%`;
  }

  function updateSelectedQuoteStyle() {
    const quote = selectedQuote();
    if (!quote) return;
    const style = currentBubbleStyle();
    quote.bubbleColor = style.color.toUpperCase();
    quote.bubbleOpacity = style.opacity;
    updateBubbleStylePreview();
    renderPreviewBubbles();
  }

  bindColorPair('bubble-color', 'bubble-color-text', updateSelectedQuoteStyle);
  field('bubble-opacity').addEventListener('input', updateSelectedQuoteStyle);

  function saveDetail() {
    if (!editorBook) return;
    const saved = updateBook({
      ...editorBook,
      quotes: cloneQuotes(editorQuotes)
    });
    editorBook = saved;
    selectedBookId = saved.id;
    showToast('상세 화면 설정을 저장했습니다.');
    showDashboard();
    loadBookIntoForm(saved);
  }

  field('open-detail-editor').addEventListener('click', openDetailEditor);
  field('detail-editor-back').addEventListener('click', showDashboard);
  field('cancel-detail-button').addEventListener('click', showDashboard);
  field('save-detail-button').addEventListener('click', saveDetail);
  field('save-detail-bottom-button').addEventListener('click', saveDetail);

  function setBgmPreview(blob, name) {
    if (bgmPreviewUrl) URL.revokeObjectURL(bgmPreviewUrl);
    bgmPreviewUrl = '';
    const preview = field('bgm-admin-preview');
    if (!blob) {
      preview.pause();
      preview.removeAttribute('src');
      preview.load();
      field('bgm-file-name').textContent = '등록된 음악이 없습니다.';
      field('remove-bgm-button').disabled = true;
      return;
    }
    bgmPreviewUrl = URL.createObjectURL(blob);
    preview.src = bgmPreviewUrl;
    preview.load();
    field('bgm-file-name').textContent = name || 'homepage-bgm.mp3';
    field('remove-bgm-button').disabled = false;
  }

  async function refreshBgmSettings() {
    try {
      const bgm = await getHomepageBgm();
      if (!pendingBgmFile) setBgmPreview(bgm.blob, bgm.bgmName);
    } catch (error) {
      console.warn('BGM 설정을 불러오지 못했습니다.', error);
      showToast('BGM 설정을 불러오지 못했습니다.');
    }
  }

  field('bgm-upload').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) {
      event.target.value = '';
      showToast('MP3 파일만 등록할 수 있습니다.');
      return;
    }
    pendingBgmFile = file;
    setBgmPreview(file, file.name);
  });

  field('save-bgm-button').addEventListener('click', async () => {
    if (!pendingBgmFile) {
      showToast('변경된 BGM 설정이 없습니다.');
      return;
    }
    const button = field('save-bgm-button');
    button.disabled = true;
    try {
      await saveHomepageBgm(pendingBgmFile);
      pendingBgmFile = null;
      field('bgm-upload').value = '';
      await refreshBgmSettings();
      showToast('홈페이지 BGM 설정을 저장했습니다.');
    } catch (error) {
      console.error('BGM 저장 실패', error);
      showToast('BGM 설정을 저장하지 못했습니다. 파일 크기와 브라우저 저장 권한을 확인해 주세요.');
    } finally {
      button.disabled = false;
    }
  });

  field('remove-bgm-button').addEventListener('click', async () => {
    if (!window.confirm('등록된 홈페이지 BGM을 삭제할까요?')) return;
    try {
      await deleteHomepageBgm();
      pendingBgmFile = null;
      field('bgm-upload').value = '';
      setBgmPreview(null, '');
      showToast('홈페이지 BGM을 삭제했습니다.');
    } catch (error) {
      console.error('BGM 삭제 실패', error);
      showToast('BGM을 삭제하지 못했습니다.');
    }
  });

  subscribeBooks(() => {
    if (adminShell.hidden) return;
    const selected = selectedBookId ? getBookById(selectedBookId) : null;
    if (selected) {
      loadBookIntoForm(selected);
    } else {
      const firstBook = getBooks()[0] || null;
      selectedBookId = firstBook?.id || null;
      if (firstBook) loadBookIntoForm(firstBook);
      else resetBookForm();
    }
    renderDashboard();
  });

  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    openSession();
  } else {
    closeSession();
  }
});
