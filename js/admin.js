// Admin Management Logic

// Session State check
const AUTH_KEY = 'surang_admin_auth';
let currentEditingBook = null;
let tempQuotesList = []; // Copy of quotes for detail editor
let selectedQuoteId = null; // Currently selected quote in detail editor
let canvasScale = 0.333333; // Dynamic scale factor based on screen size

function resizeCanvasContainer() {
  const wrapper = document.querySelector('.canvas-wrapper-outer');
  const container = document.getElementById('preview-canvas-container');
  if (wrapper && container) {
    const wrapperWidth = wrapper.offsetWidth;
    canvasScale = wrapperWidth / 1920;
    container.style.transform = `scale(${canvasScale})`;
  }
}
window.addEventListener('resize', resizeCanvasContainer);

// Pagination State
let currentPage = 1;
const rowsPerPage = 5;

// DOM Elements
const viewLogin = document.getElementById('view-login');
const adminSystemContainer = document.getElementById('admin-system-container');
const viewDashboard = document.getElementById('view-dashboard');
const viewDetailEdit = document.getElementById('view-detail-edit');

// Edit Form fields
const editBookId = document.getElementById('edit-book-id');
const editTitle = document.getElementById('edit-title');
const editSubtitle = document.getElementById('edit-subtitle');
const editSpineTitle = document.getElementById('edit-spine-title');
const editConcept = document.getElementById('edit-concept');
const editContact = document.getElementById('edit-contact');
const characterChipsArea = document.getElementById('character-chips-area');
const characterChipInput = document.getElementById('character-chip-input');

let currentCharacters = [];

// Base64 storage placeholders
let uploadedSpineImage = '';
let uploadedCoverImage = '';
let uploadedDetailBgImage = '';

// -------------------------------------------------------------
// 1. AUTHENTICATION & VIEWS
// -------------------------------------------------------------
function checkAuth() {
  const isAuth = sessionStorage.getItem(AUTH_KEY);
  if (isAuth === 'true') {
    viewLogin.classList.remove('active');
    adminSystemContainer.classList.add('active');
    renderBooksTable();
    resetEditForm();
  } else {
    viewLogin.classList.add('active');
    adminSystemContainer.classList.remove('active');
  }
}

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;

  // Simple hardcoded credentials
  if (user === 'admin' && pass === 'surang1234') {
    sessionStorage.setItem(AUTH_KEY, 'true');
    checkAuth();
  } else {
    alert('계정 또는 비밀번호가 틀렸습니다.');
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  checkAuth();
});

// -------------------------------------------------------------
// 2. DASHBOARD BOOK TABLE LIST
// -------------------------------------------------------------
function renderBooksTable() {
  const tableBody = document.getElementById('books-table-body');
  tableBody.innerHTML = '';

  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  const conceptFilter = document.getElementById('concept-filter').value;

  let filtered = getBooks();

  // Apply filters
  if (searchQuery) {
    filtered = filtered.filter(b => 
      b.title.toLowerCase().includes(searchQuery) || 
      b.concept.toLowerCase().includes(searchQuery) ||
      (b.participatingCharacters && b.participatingCharacters.some(c => c.toLowerCase().includes(searchQuery)))
    );
  }
  if (conceptFilter) {
    filtered = filtered.filter(b => b.concept === conceptFilter);
  }

  // Pagination bounds
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const paginatedItems = filtered.slice(startIndex, endIndex);

  // Update pagination info label
  document.getElementById('pagination-info').textContent = 
    `총 ${totalItems}개의 도서 중 ${totalItems > 0 ? startIndex + 1 : 0}-${endIndex} 표시 중`;

  // Render pages
  const pageContainer = document.getElementById('pagination-pages');
  pageContainer.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const pageLink = document.createElement('button');
    pageLink.className = `page-link ${i === currentPage ? 'active' : ''}`;
    pageLink.textContent = i;
    pageLink.addEventListener('click', () => {
      currentPage = i;
      renderBooksTable();
    });
    pageContainer.appendChild(pageLink);
  }

  if (paginatedItems.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-placeholder);">검색 결과가 없습니다.</td></tr>`;
    return;
  }

  paginatedItems.forEach(book => {
    const row = document.createElement('tr');

    // Thumbnail column
    const spineBg = book.spineImage ? `background-image: url(${book.spineImage}); background-size: cover;` : `background-color: ${book.spineColor || '#B27171'};`;
    const thumbnailCell = `
      <td>
        <div class="mini-spine-preview" style="${spineBg}">
          ${book.spineImage ? '' : `<span>${book.spineTitle || book.title}</span>`}
        </div>
      </td>
    `;

    // Title & Sub
    const titleCell = `
      <td>
        <strong>${book.title}</strong><br>
        <small style="color: var(--text-muted);">${book.subtitle || ''}</small>
      </td>
    `;

    // Characters Chips list
    const charsList = book.participatingCharacters && book.participatingCharacters.length > 0
      ? book.participatingCharacters.map(c => `#${c}`).join(', ')
      : '없음';
    const charactersCell = `<td>${charsList}</td>`;

    // Concept
    const conceptCell = `<td>${book.concept}</td>`;

    // Status switch
    const statusCell = `
      <td>
        <button class="switch-status-btn ${book.status === 'active' ? 'active' : ''}" 
                onclick="toggleBookStatus('${book.id}')" aria-label="상태 전환"></button>
      </td>
    `;

    // Action buttons
    const actionsCell = `
      <td>
        <div class="table-actions">
          <button class="btn-icon" onclick="editBookForm('${book.id}')" title="편집">
            <span class="icon-edit-pencil"></span>
          </button>
          <button class="btn-icon delete" onclick="confirmDeleteBook('${book.id}')" title="삭제">
            <span class="icon-delete-trash"></span>
          </button>
        </div>
      </td>
    `;

    row.innerHTML = thumbnailCell + titleCell + charactersCell + conceptCell + statusCell + actionsCell;
    tableBody.appendChild(row);
  });
}

// Add filter event listeners
document.getElementById('search-input').addEventListener('input', () => {
  currentPage = 1;
  renderBooksTable();
});
document.getElementById('concept-filter').addEventListener('change', () => {
  currentPage = 1;
  renderBooksTable();
});

// Toggle active/inactive status
window.toggleBookStatus = function(bookId) {
  const book = getBookById(bookId);
  if (book) {
    book.status = book.status === 'active' ? 'inactive' : 'active';
    updateBook(book);
    renderBooksTable();
  }
};

window.confirmDeleteBook = function(bookId) {
  const book = getBookById(bookId);
  if (book && confirm(`"${book.title}" 도서를 정말로 삭제하시겠습니까?`)) {
    deleteBook(bookId);
    renderBooksTable();
    resetEditForm();
  }
};

// -------------------------------------------------------------
// 3. EDIT FORM SIDEBAR CONTROLS
// -------------------------------------------------------------
function resetEditForm() {
  currentEditingBook = null;
  editBookId.value = '';
  editTitle.value = '';
  editSubtitle.value = '';
  editSpineTitle.value = '';
  editConcept.value = '세계 명작';
  editContact.value = '';
  
  currentCharacters = [];
  renderChips();

  uploadedSpineImage = '';
  uploadedCoverImage = '';
  uploadedDetailBgImage = '';

  document.getElementById('filename-spine-img').textContent = '선택된 파일 없음';
  document.getElementById('filename-cover-img').textContent = '선택된 파일 없음';
  document.getElementById('filename-detail-bg-img').textContent = '선택된 파일 없음';

  document.getElementById('upload-spine-img').value = '';
  document.getElementById('upload-cover-img').value = '';
  document.getElementById('upload-detail-bg-img').value = '';

  document.getElementById('btn-edit-detail-page').style.display = 'block';
  document.getElementById('edit-form-panel').querySelector('h3').textContent = '새 도서 추가';
}

document.getElementById('btn-add-new').addEventListener('click', resetEditForm);
document.getElementById('btn-cancel-edit').addEventListener('click', resetEditForm);

window.editBookForm = function(bookId) {
  const book = getBookById(bookId);
  if (!book) return;

  currentEditingBook = book;
  editBookId.value = book.id;
  editTitle.value = book.title;
  editSubtitle.value = book.subtitle || '';
  editSpineTitle.value = book.spineTitle || '';
  editConcept.value = book.concept || '세계 명작';
  editContact.value = book.contact || '';

  currentCharacters = [...(book.participatingCharacters || [])];
  renderChips();

  uploadedSpineImage = book.spineImage || '';
  uploadedCoverImage = book.coverImage || '';
  uploadedDetailBgImage = book.detailBgImage || '';

  document.getElementById('filename-spine-img').textContent = book.spineImage ? '이미지 업로드됨' : '선택된 파일 없음';
  document.getElementById('filename-cover-img').textContent = book.coverImage ? '이미지 업로드됨' : '선택된 파일 없음';
  document.getElementById('filename-detail-bg-img').textContent = book.detailBgImage ? '이미지 업로드됨' : '선택된 파일 없음';

  document.getElementById('btn-edit-detail-page').style.display = 'block';
  document.getElementById('edit-form-panel').querySelector('h3').textContent = '도서 상세 편집';
  
  // Smooth scroll edit panel into view (mobile)
  document.getElementById('edit-form-panel').scrollIntoView({ behavior: 'smooth' });
};

// Character Hashtag Chips logic
function renderChips() {
  // Remove existing chips (exclude input)
  const chips = characterChipsArea.querySelectorAll('.character-chip');
  chips.forEach(c => c.remove());

  currentCharacters.forEach((char, idx) => {
    const chip = document.createElement('div');
    chip.className = 'character-chip';
    chip.innerHTML = `
      <span>#${char}</span>
      <button type="button" class="btn-chip-delete" onclick="deleteChip(${idx})">&times;</button>
    `;
    // Insert before input field
    characterChipsArea.insertBefore(chip, characterChipInput);
  });
}

window.deleteChip = function(idx) {
  currentCharacters.splice(idx, 1);
  renderChips();
};

characterChipInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = characterChipInput.value.trim().replace('#', '');
    if (val && !currentCharacters.includes(val)) {
      currentCharacters.push(val);
      renderChips();
    }
    characterChipInput.value = '';
  }
});

// Image Uploads Base64 conversion
function handleImageUpload(inputEl, callback, labelEl) {
  inputEl.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        callback(event.target.result);
        labelEl.textContent = file.name;
      };
      reader.readAsDataURL(file);
    }
  });
}

handleImageUpload(
  document.getElementById('upload-spine-img'),
  (base64) => { uploadedSpineImage = base64; },
  document.getElementById('filename-spine-img')
);
handleImageUpload(
  document.getElementById('upload-cover-img'),
  (base64) => { uploadedCoverImage = base64; },
  document.getElementById('filename-cover-img')
);
handleImageUpload(
  document.getElementById('upload-detail-bg-img'),
  (base64) => { uploadedDetailBgImage = base64; },
  document.getElementById('filename-detail-bg-img')
);

// Submit Edit Form
document.getElementById('book-edit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const id = editBookId.value;
  const title = editTitle.value.trim();
  const subtitle = editSubtitle.value.trim();
  const spineTitle = editSpineTitle.value.trim();
  const concept = editConcept.value;
  const contact = editContact.value.trim();

  if (!title) return;

  if (id) {
    // Modify existing
    const book = getBookById(id);
    if (book) {
      book.title = title;
      book.subtitle = subtitle;
      book.spineTitle = spineTitle;
      book.concept = concept;
      book.contact = contact;
      book.participatingCharacters = currentCharacters;
      book.spineImage = uploadedSpineImage;
      book.coverImage = uploadedCoverImage;
      book.detailBgImage = uploadedDetailBgImage;

      updateBook(book);
      alert('도서 정보가 수정되었습니다.');
    }
  } else {
    // Create new
    const newBook = {
      title,
      subtitle,
      spineTitle: spineTitle || title,
      concept,
      contact,
      status: 'active',
      spineHeight: Math.floor(Math.random() * 40) + 220, // Random default height 220~260
      spineColor: getRandomSpineColor(),
      participatingCharacters: currentCharacters,
      spineImage: uploadedSpineImage,
      coverImage: uploadedCoverImage || 'assets/images/popup-cover-image.png',
      detailBgImage: uploadedDetailBgImage || 'assets/images/hero-banner-image.png',
      quotes: [
        { id: 'q-new-1', text: '캐릭터 한마디', tail: 'C', x: 200, y: 200 }
      ],
      bgGradient: {
        color1: '#2DD4BF',
        color2: '#0F766E',
        direction: '135deg',
        opacity: 90
      }
    };
    addBook(newBook);
    alert('새 도서가 등록되었습니다.');
  }

  renderBooksTable();
  resetEditForm();
});

function getRandomSpineColor() {
  const colors = ['#2B4335', '#C98E3A', '#B27171', '#52436D', '#3D5A6C'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// -------------------------------------------------------------
// 4. DETAIL PAGE CANVAS EDITOR VIEW
// -------------------------------------------------------------
const btnEditDetailPage = document.getElementById('btn-edit-detail-page');
const previewCanvasContainer = document.getElementById('preview-canvas-container');
const canvasBgImg = document.getElementById('canvas-bg-img');
const canvasGradientOverlay = document.getElementById('canvas-gradient-overlay');
const canvasBubblesArea = document.getElementById('canvas-bubbles-area');

// Gradient inputs
const editColor1 = document.getElementById('edit-color-1');
const editColor1Text = document.getElementById('edit-color-1-text');
const editColor2 = document.getElementById('edit-color-2');
const editColor2Text = document.getElementById('edit-color-2-text');
const editGradientDir = document.getElementById('edit-gradient-dir');
const editOverlayOpacity = document.getElementById('edit-overlay-opacity');
const opacityValLabel = document.getElementById('opacity-val-label');

btnEditDetailPage.addEventListener('click', () => {
  if (!currentEditingBook) {
    const title = editTitle.value.trim();
    if (!title) {
      alert('상세페이지를 편집하려면 먼저 도서 제목(페어명)을 입력해야 합니다.');
      return;
    }

    const subtitle = editSubtitle.value.trim();
    const spineTitle = editSpineTitle.value.trim();
    const concept = editConcept.value;
    const contact = editContact.value.trim();

    const newBook = {
      title,
      subtitle,
      spineTitle: spineTitle || title,
      concept,
      contact,
      status: 'active',
      spineHeight: Math.floor(Math.random() * 40) + 220,
      spineColor: getRandomSpineColor(),
      participatingCharacters: currentCharacters,
      spineImage: uploadedSpineImage,
      coverImage: uploadedCoverImage || 'assets/images/popup-cover-image.png',
      detailBgImage: uploadedDetailBgImage || 'assets/images/hero-banner-image.png',
      quotes: [
        { id: 'q-new-1', text: '캐릭터 한마디', tail: 'C', x: 200, y: 200 }
      ],
      bgGradient: {
        color1: '#2DD4BF',
        color2: '#0F766E',
        direction: '135deg',
        opacity: 90
      }
    };

    const saved = addBook(newBook);
    currentEditingBook = saved;
    editBookId.value = saved.id;
    renderBooksTable();
  }

  // Toggle layout views
  viewDashboard.classList.remove('active');
  viewDetailEdit.classList.add('active');

  // Recalculate dynamic canvas scale based on screen width
  setTimeout(resizeCanvasContainer, 100);

  // Load book details
  document.getElementById('detail-edit-book-title').textContent = `${currentEditingBook.title} - 상세페이지 편집`;
  
  // Set Canvas Background
  if (uploadedDetailBgImage) {
    canvasBgImg.style.backgroundImage = `url(${uploadedDetailBgImage})`;
  } else {
    canvasBgImg.style.backgroundImage = 'none';
  }

  // Load gradient values
  const gradient = currentEditingBook.bgGradient || { color1: '#2DD4BF', color2: '#0F766E', direction: '135deg', opacity: 90 };
  editColor1.value = gradient.color1 || '#2DD4BF';
  editColor1Text.value = gradient.color1 || '#2DD4BF';
  editColor2.value = gradient.color2 || '#0F766E';
  editColor2Text.value = gradient.color2 || '#0F766E';
  editGradientDir.value = gradient.direction || '135deg';
  editOverlayOpacity.value = gradient.opacity || 90;
  opacityValLabel.textContent = `${editOverlayOpacity.value}%`;

  // Make copy of quotes
  tempQuotesList = JSON.parse(JSON.stringify(currentEditingBook.quotes || []));
  selectedQuoteId = tempQuotesList.length > 0 ? tempQuotesList[0].id : null;

  renderCanvasEditor();
  loadSelectedQuoteGradient();
});

// Load Selected Quote's Gradient details into the sidebar controllers
function loadSelectedQuoteGradient() {
  const q = tempQuotesList.find(quote => quote.id === selectedQuoteId);
  if (!q) return;

  const gradient = q.bgGradient || { color1: '#E879F9', color2: '#C084FC', direction: '135deg', opacity: 85 };
  editColor1.value = gradient.color1 || '#E879F9';
  editColor1Text.value = (gradient.color1 || '#E879F9').toUpperCase();
  editColor2.value = gradient.color2 || '#C084FC';
  editColor2Text.value = (gradient.color2 || '#C084FC').toUpperCase();
  editGradientDir.value = gradient.direction || '135deg';
  editOverlayOpacity.value = gradient.opacity || 85;
  opacityValLabel.textContent = `${editOverlayOpacity.value}%`;

  // Also update compact editor swatch bar
  const swatchPreview = document.getElementById('edit-gradient-preview');
  swatchPreview.style.background = `linear-gradient(90deg, ${editColor1.value} 0%, ${editColor2.value} 100%)`;
}

// Sync HEX Text and Color Picker input
function syncColorPicker(picker, textEl) {
  picker.addEventListener('input', () => {
    textEl.value = picker.value.toUpperCase();
    updateCanvasGradient();
  });
  textEl.addEventListener('change', () => {
    let val = textEl.value.trim();
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      picker.value = val;
      updateCanvasGradient();
    }
  });
}
syncColorPicker(editColor1, editColor1Text);
syncColorPicker(editColor2, editColor2Text);

editGradientDir.addEventListener('change', updateCanvasGradient);
editOverlayOpacity.addEventListener('input', () => {
  opacityValLabel.textContent = `${editOverlayOpacity.value}%`;
  updateCanvasGradient();
});

function updateCanvasGradient() {
  const q = tempQuotesList.find(quote => quote.id === selectedQuoteId);
  if (!q) return;

  // Save values to the selected quote's bgGradient
  q.bgGradient = {
    color1: editColor1.value,
    color2: editColor2.value,
    direction: editGradientDir.value,
    opacity: parseInt(editOverlayOpacity.value)
  };

  const c1 = hexToRgba(editColor1.value, editOverlayOpacity.value / 100);
  const c2 = hexToRgba(editColor2.value, editOverlayOpacity.value / 100);
  const dir = editGradientDir.value;
  
  // Clear full background overlay
  canvasGradientOverlay.style.background = 'none';
  
  // Apply colors dynamically to the selected bubble on the preview canvas
  const bubbleEl = canvasBubblesArea.querySelector(`[data-id="${selectedQuoteId}"]`);
  if (bubbleEl) {
    const bDiv = bubbleEl.querySelector('.quote-bubble');
    if (bDiv) {
      bDiv.style.background = `linear-gradient(${dir}, ${c1} 0%, ${c2} 100%)`;
    }
    bubbleEl.style.setProperty('--bubble-tail-color', c2);
  }
  
  // Also update compact editor swatch bar
  const swatchPreview = document.getElementById('edit-gradient-preview');
  swatchPreview.style.background = `linear-gradient(90deg, ${editColor1.value} 0%, ${editColor2.value} 100%)`;
}

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

// Render Canvas Bubbles & Quote List Manager
function renderCanvasEditor() {
  renderQuotesManagerList();
  renderDraggableBubbles();
  resizeCanvasContainer();
}

function renderQuotesManagerList() {
  const listContainer = document.getElementById('edit-quotes-list-container');
  listContainer.innerHTML = '';

  tempQuotesList.forEach((q, idx) => {
    const row = document.createElement('div');
    row.className = `quote-item-row ${q.id === selectedQuoteId ? 'selected' : ''}`;
    row.setAttribute('data-quote-id', q.id);
    row.innerHTML = `
      <div class="grip-handle" title="순서 드래그"></div>
      <textarea class="quote-textarea" oninput="updateQuoteText('${q.id}', this.value)" onclick="event.stopPropagation();" placeholder="대사를 입력해 주세요.">${q.text}</textarea>
      <button type="button" class="tail-select-btn" onclick="cycleTail('${q.id}'); event.stopPropagation();">꼬리: ${q.tail}</button>
      <button type="button" class="delete-quote-btn" onclick="deleteQuote('${q.id}'); event.stopPropagation();">
        <span class="icon-x"></span>
      </button>
    `;

    row.addEventListener('click', () => {
      selectedQuoteId = q.id;
      // Highlighting change manually to prevent recreating elements
      document.querySelectorAll('.quote-item-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');

      document.querySelectorAll('.draggable-bubble-group').forEach(b => b.classList.remove('selected'));
      const activeBubble = canvasBubblesArea.querySelector(`[data-id="${q.id}"]`);
      if (activeBubble) activeBubble.classList.add('selected');

      loadSelectedQuoteGradient();
    });

    listContainer.appendChild(row);
  });
}

// Live update quote text and sync to canvas preview
window.updateQuoteText = function(quoteId, newText) {
  const q = tempQuotesList.find(quote => quote.id === quoteId);
  if (q) {
    q.text = newText;
    const bubbleEl = canvasBubblesArea.querySelector(`[data-id="${quoteId}"]`);
    if (bubbleEl) {
      const pEl = bubbleEl.querySelector('.quote-bubble p');
      if (pEl) {
        pEl.textContent = `“${newText}”`;
      }
    }
  }
};

// Tail direction cycle (L -> C -> R -> L)
window.cycleTail = function(quoteId) {
  const q = tempQuotesList.find(quote => quote.id === quoteId);
  if (q) {
    if (q.tail === 'L') q.tail = 'C';
    else if (q.tail === 'C') q.tail = 'R';
    else q.tail = 'L';
    
    renderCanvasEditor();
  }
};

window.deleteQuote = function(quoteId) {
  tempQuotesList = tempQuotesList.filter(q => q.id !== quoteId);
  if (selectedQuoteId === quoteId) {
    selectedQuoteId = tempQuotesList.length > 0 ? tempQuotesList[0].id : null;
  }
  renderCanvasEditor();
  loadSelectedQuoteGradient();
};

// Add new quote to temporary list
document.getElementById('btn-add-quote').addEventListener('click', () => {
  const input = document.getElementById('new-quote-input');
  const txt = input.value.trim();
  if (txt) {
    const newQ = {
      id: 'q-temp-' + Date.now(),
      text: txt,
      tail: 'C',
      x: 200, // Spawn at center defaults
      y: 200,
      bgGradient: {
        color1: '#E879F9',
        color2: '#C084FC',
        direction: '135deg',
        opacity: 85
      }
    };
    tempQuotesList.push(newQ);
    selectedQuoteId = newQ.id;
    input.value = '';
    renderCanvasEditor();
    loadSelectedQuoteGradient();
  }
});

// Render Draggable Quote Bubbles in Canvas
function renderDraggableBubbles() {
  canvasBubblesArea.innerHTML = '';

  tempQuotesList.forEach((q) => {
    const bubble = document.createElement('div');
    bubble.className = `draggable-bubble-group tail-${q.tail || 'C'} ${q.id === selectedQuoteId ? 'selected' : ''}`;
    bubble.style.left = `${q.x}px`;
    bubble.style.top = `${q.y}px`;
    bubble.setAttribute('data-id', q.id);

    bubble.innerHTML = `
      <div class="quote-bubble">
        <p>“${q.text}”</p>
      </div>
      <div class="bubble-tail-vector"></div>
    `;

    // Apply styles to preview bubble body and tail mask from this specific quote's gradient
    const qGradient = Object.assign({
      color1: '#E879F9',
      color2: '#C084FC',
      direction: '135deg',
      opacity: 85
    }, q.bgGradient || {});
    const qAlpha = (qGradient.opacity / 100).toFixed(2);
    const qc1 = hexToRgba(qGradient.color1, qAlpha);
    const qc2 = hexToRgba(qGradient.color2, qAlpha);

    const bubbleDiv = bubble.querySelector('.quote-bubble');
    bubbleDiv.style.background = `linear-gradient(${qGradient.direction || '135deg'}, ${qc1} 0%, ${qc2} 100%)`;
    bubble.style.setProperty('--bubble-tail-color', qc2);

    // Mousedown selects the quote immediately!
    bubble.addEventListener('mousedown', () => {
      if (selectedQuoteId !== q.id) {
        selectedQuoteId = q.id;

        // Visual selection list updates
        document.querySelectorAll('.quote-item-row').forEach(r => r.classList.remove('selected'));
        const activeRow = document.querySelector(`.quote-item-row[data-quote-id="${q.id}"]`);
        if (activeRow) activeRow.classList.add('selected');

        // Visual selection canvas updates
        document.querySelectorAll('.draggable-bubble-group').forEach(b => b.classList.remove('selected'));
        bubble.classList.add('selected');

        loadSelectedQuoteGradient();
      }
    });

    // Attach custom drag events
    makeElementDraggable(bubble, q);

    canvasBubblesArea.appendChild(bubble);
  });
}

// Vanilla JS drag-and-drop mechanism for canvas preview positioning
function makeElementDraggable(element, quoteObj) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  element.addEventListener('mousedown', dragMouseDown);

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    
    // Get mouse position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
    
    element.classList.add('dragging');
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    
    // Calculate new position cursor (compensated for CSS transform scale)
    pos1 = (pos3 - e.clientX) / canvasScale;
    pos2 = (pos4 - e.clientY) / canvasScale;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Calculate values
    let newLeft = element.offsetLeft - pos1;
    let newTop = element.offsetTop - pos2;

    // Boundary constraints check (1920x1080 canvas size)
    const containerWidth = 1920;
    const containerHeight = 1080;
    const elWidth = element.offsetWidth;
    const elHeight = element.offsetHeight;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft > containerWidth - elWidth) newLeft = containerWidth - elWidth;
    if (newTop > containerHeight - elHeight) newTop = containerHeight - elHeight;

    // Apply positioning styles
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;

    // Save back to temporary object coordinates directly in 1920x1080 space
    quoteObj.x = Math.round(newLeft);
    quoteObj.y = Math.round(newTop);
  }

  function closeDragElement() {
    // Remove listeners
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
    element.classList.remove('dragging');
  }
}

// Return from Detail Edit to dashboard list
function exitDetailEditor() {
  viewDetailEdit.classList.remove('active');
  viewDashboard.classList.add('active');
}

document.getElementById('btn-back-to-list').addEventListener('click', exitDetailEditor);
document.getElementById('btn-cancel-detail').addEventListener('click', exitDetailEditor);

// Save Detail Edit coordinates & config
document.getElementById('btn-save-detail').addEventListener('click', () => {
  if (!currentEditingBook) return;

  // Save quotes list
  currentEditingBook.quotes = tempQuotesList;

  updateBook(currentEditingBook);
  alert('상세페이지 편집 사양이 저장되었습니다.');
  exitDetailEditor();
  renderBooksTable();
});

// -------------------------------------------------------------
// 5. INITIAL LOAD
// -------------------------------------------------------------
window.addEventListener('load', () => {
  checkAuth();
});
