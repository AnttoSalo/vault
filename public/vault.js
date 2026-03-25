// ── Toast ──
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Helpers ──
function isInputFocused() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
}

async function copySecret(id) {
  try {
    const res = await fetch(`/api/entry/${id}/secret`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    const data = await res.json();
    if (data.secret) {
      await navigator.clipboard.writeText(data.secret);
      showToast('Secret copied', 'success');
      return true;
    }
  } catch { showToast('Failed to copy', 'error'); }
  return false;
}

async function copyUsername(id) {
  try {
    const res = await fetch(`/api/entry/${id}/secret`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    const data = await res.json();
    if (data.username) {
      await navigator.clipboard.writeText(data.username);
      showToast('Username copied', 'success');
      return true;
    } else {
      showToast('No username set', 'error');
    }
  } catch { showToast('Failed to copy', 'error'); }
  return false;
}

// ── Clipboard copy (detail page) ──
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  const text = btn.dataset.copy;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard', 'success');
    const icon = btn.querySelector('i');
    icon.className = 'bi bi-check-lg';
    setTimeout(() => { icon.className = 'bi bi-clipboard'; }, 1500);
  });
});

// ── Quick-copy buttons (list view) ──
document.addEventListener('click', (e) => {
  const secretBtn = e.target.closest('.quick-copy-secret');
  const userBtn = e.target.closest('.quick-copy-user');
  const btn = secretBtn || userBtn;
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const id = btn.dataset.id;
  const icon = btn.querySelector('i');
  const origClass = icon.className;
  if (secretBtn) {
    copySecret(id).then((ok) => {
      if (ok) { icon.className = 'bi bi-check-lg'; setTimeout(() => icon.className = origClass, 1500); }
    });
  } else {
    copyUsername(id).then((ok) => {
      if (ok) { icon.className = 'bi bi-check-lg'; setTimeout(() => icon.className = origClass, 1500); }
    });
  }
});

// ── Pin toggle ──
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.pin-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const id = btn.dataset.id;
  fetch(`/api/entry/${id}/pin`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(r => r.json())
    .then(data => {
      const icon = btn.querySelector('i');
      if (data.pinned) {
        btn.classList.add('active');
        icon.className = 'bi bi-star-fill';
        btn.title = 'Unpin';
        showToast('Entry pinned', 'success');
      } else {
        btn.classList.remove('active');
        icon.className = 'bi bi-star';
        btn.title = 'Pin';
        showToast('Entry unpinned', 'success');
      }
    });
});

// ── Show/hide secret on detail page ──
document.querySelectorAll('.toggle-vis').forEach((btn) => {
  btn.addEventListener('click', () => {
    const field = btn.closest('.field-value');
    const span = field.querySelector('.masked-value');
    const icon = btn.querySelector('i');
    if (span.classList.contains('secret-masked')) {
      span.textContent = span.dataset.value;
      span.classList.remove('secret-masked');
      icon.className = 'bi bi-eye-slash';
    } else {
      span.textContent = '\u2022'.repeat(12);
      span.classList.add('secret-masked');
      icon.className = 'bi bi-eye';
    }
  });
});

// ── Toggle secret visibility on form ──
const toggleSecret = document.getElementById('toggle-secret');
if (toggleSecret) {
  toggleSecret.addEventListener('click', () => {
    const input = document.getElementById('secret');
    const icon = toggleSecret.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'bi bi-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'bi bi-eye';
    }
  });
}

// ── Password generator ──
const generateBtn = document.getElementById('generate-pw');
if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_-+=';
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const pw = Array.from(array, (b) => chars[b % chars.length]).join('');
    const input = document.getElementById('secret');
    input.value = pw;
    input.type = 'text';
    const toggleIcon = document.querySelector('#toggle-secret i');
    if (toggleIcon) toggleIcon.className = 'bi bi-eye-slash';
    updateStrength(pw);
    showToast('Password generated', 'success');
  });
}

// ── Password strength indicator ──
function updateStrength(value) {
  const bar = document.getElementById('pw-strength-bar');
  const label = document.getElementById('pw-strength-label');
  if (!bar || !label) return;

  if (!value) { bar.style.width = '0%'; label.textContent = ''; return; }

  let charsetSize = 0;
  if (/[a-z]/.test(value)) charsetSize += 26;
  if (/[A-Z]/.test(value)) charsetSize += 26;
  if (/[0-9]/.test(value)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(value)) charsetSize += 32;
  const entropy = value.length * Math.log2(charsetSize || 1);

  let level, color, pct;
  if (entropy < 40) { level = 'Weak'; color = '#ef4444'; pct = 25; }
  else if (entropy < 60) { level = 'Fair'; color = '#f59e0b'; pct = 50; }
  else if (entropy < 80) { level = 'Good'; color = '#3b82f6'; pct = 75; }
  else { level = 'Strong'; color = '#22c55e'; pct = 100; }

  bar.style.width = pct + '%';
  bar.style.backgroundColor = color;
  label.textContent = level;
  label.style.color = color;
}

const secretInput = document.getElementById('secret');
if (secretInput) {
  secretInput.addEventListener('input', () => updateStrength(secretInput.value));
  if (secretInput.value) updateStrength(secretInput.value);
}

// ── Delete confirmation ──
const deleteForm = document.getElementById('delete-form');
if (deleteForm) {
  deleteForm.addEventListener('submit', (e) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      e.preventDefault();
    }
  });
}

// ── Search debounce ──
const searchInput = document.getElementById('search-input');
if (searchInput) {
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      searchInput.closest('form').submit();
    }, 400);
  });
}

// ── Import modal ──
const importBtn = document.getElementById('import-btn');
const importModal = document.getElementById('import-modal');
const importCancel = document.getElementById('import-cancel');

if (importBtn && importModal) {
  importBtn.addEventListener('click', () => importModal.classList.add('active'));
  importCancel.addEventListener('click', () => importModal.classList.remove('active'));
  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) importModal.classList.remove('active');
  });
}

// ── File import (drag & drop + file picker) ──
const importFile = document.getElementById('import-file');
const importData = document.getElementById('import-data');
const importDropzone = document.getElementById('import-dropzone');

if (importFile && importData) {
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { importData.value = reader.result; showToast('File loaded', 'success'); };
    reader.readAsText(file);
  });
}

if (importDropzone && importData) {
  importDropzone.addEventListener('dragover', (e) => { e.preventDefault(); importDropzone.classList.add('drag-over'); });
  importDropzone.addEventListener('dragleave', () => importDropzone.classList.remove('drag-over'));
  importDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    importDropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { importData.value = reader.result; showToast('File loaded', 'success'); };
    reader.readAsText(file);
  });
}

// ── Shortcuts help modal ──
const shortcutsModal = document.getElementById('shortcuts-modal');
const shortcutsBtn = document.getElementById('shortcuts-btn');
const shortcutsClose = document.getElementById('shortcuts-close');

if (shortcutsBtn && shortcutsModal) {
  shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('active'));
}
if (shortcutsClose && shortcutsModal) {
  shortcutsClose.addEventListener('click', () => shortcutsModal.classList.remove('active'));
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) shortcutsModal.classList.remove('active');
  });
}

// ══════════════════════════════════════════════
// ── Command Palette ──
// ══════════════════════════════════════════════
const palette = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');
let paletteEntries = [];
let paletteIndex = -1;

const TYPE_ICONS = {
  'api-key': 'bi-key-fill',
  'database': 'bi-database-fill',
  'ssh-key': 'bi-terminal-fill',
  'note': 'bi-sticky-fill',
  'ftp': 'bi-hdd-network-fill',
  'password': 'bi-lock-fill',
};

const COMMANDS = [
  { name: 'New entry', icon: 'bi-plus-lg', action: () => location.href = '/new' },
  { name: 'Export backup', icon: 'bi-download', action: () => location.href = '/export' },
  { name: 'Import backup', icon: 'bi-upload', action: () => { closePalette(); importModal?.classList.add('active'); } },
];

function openPalette() {
  if (!palette) return;
  palette.classList.add('active');
  paletteInput.value = '';
  paletteIndex = -1;
  paletteInput.focus();
  // Fetch entries if not cached (or re-fetch for freshness)
  fetch('/api/entries', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(r => r.json())
    .then(data => { paletteEntries = data; renderPalette(''); });
}

function closePalette() {
  if (!palette) return;
  palette.classList.remove('active');
  paletteInput.value = '';
  paletteEntries = [];
}

function renderPalette(query) {
  if (!paletteResults) return;
  const q = query.toLowerCase().trim();

  // Command mode
  if (q.startsWith('>')) {
    const cmdQuery = q.slice(1).trim();
    const filtered = COMMANDS.filter(c => c.name.toLowerCase().includes(cmdQuery));
    paletteResults.innerHTML = filtered.map((c, i) =>
      `<div class="palette-item ${i === paletteIndex ? 'selected' : ''}" data-cmd="${i}">
        <i class="bi ${c.icon} palette-item-icon"></i>
        <span class="palette-item-name">${c.name}</span>
      </div>`
    ).join('') || '<div class="palette-empty">No commands found</div>';
    return;
  }

  // Entry mode
  let filtered = paletteEntries;
  if (q) {
    filtered = paletteEntries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.tags && e.tags.toLowerCase().includes(q)) ||
      e.category.toLowerCase().includes(q)
    );
  }

  paletteResults.innerHTML = filtered.slice(0, 15).map((e, i) =>
    `<div class="palette-item ${i === paletteIndex ? 'selected' : ''}" data-id="${e.id}">
      <i class="bi ${TYPE_ICONS[e.type] || 'bi-lock-fill'} palette-item-icon"></i>
      <span class="palette-item-name">${e.name}</span>
      <span class="badge badge-${e.category} palette-item-badge">${e.category.replace('-', ' ')}</span>
      ${e.pinned ? '<i class="bi bi-star-fill palette-item-pin"></i>' : ''}
      <div class="palette-item-actions">
        <button class="btn-icon palette-copy" data-id="${e.id}" title="Copy secret"><i class="bi bi-clipboard"></i></button>
      </div>
    </div>`
  ).join('') || '<div class="palette-empty">No entries found</div>';
}

if (paletteInput) {
  paletteInput.addEventListener('input', () => {
    paletteIndex = -1;
    renderPalette(paletteInput.value);
  });
}

if (paletteResults) {
  paletteResults.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.palette-copy');
    if (copyBtn) {
      e.stopPropagation();
      copySecret(copyBtn.dataset.id);
      closePalette();
      return;
    }
    const item = e.target.closest('.palette-item');
    if (!item) return;
    if (item.dataset.cmd !== undefined) {
      COMMANDS[parseInt(item.dataset.cmd)]?.action();
      closePalette();
    } else if (item.dataset.id) {
      location.href = `/entry/${item.dataset.id}`;
    }
  });
}

if (palette) {
  palette.addEventListener('click', (e) => {
    if (e.target === palette) closePalette();
  });
}

// ══════════════════════════════════════════════
// ── Keyboard Shortcuts ──
// ══════════════════════════════════════════════
let selectedIndex = -1;

function getEntryCards() {
  return Array.from(document.querySelectorAll('#entry-list .entry-card'));
}

function selectCard(index) {
  const cards = getEntryCards();
  if (cards.length === 0) return;
  cards.forEach(c => c.classList.remove('selected'));
  selectedIndex = Math.max(0, Math.min(index, cards.length - 1));
  cards[selectedIndex].classList.add('selected');
  cards[selectedIndex].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('keydown', (e) => {
  const paletteOpen = palette?.classList.contains('active');
  const anyModalOpen = document.querySelector('.modal-overlay.active');

  // Ctrl+K — command palette (always)
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (paletteOpen) closePalette(); else openPalette();
    return;
  }

  // Escape — close modals/palette, or go back
  if (e.key === 'Escape') {
    if (paletteOpen) { closePalette(); return; }
    if (anyModalOpen) { anyModalOpen.classList.remove('active'); return; }
    // On detail page, go back
    const backLink = document.querySelector('.back-link');
    if (backLink && !isInputFocused()) { backLink.click(); return; }
    return;
  }

  // Palette keyboard navigation
  if (paletteOpen) {
    const items = paletteResults?.querySelectorAll('.palette-item') || [];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteIndex = Math.min(paletteIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('selected', i === paletteIndex));
      items[paletteIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteIndex = Math.max(paletteIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle('selected', i === paletteIndex));
      items[paletteIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = items[paletteIndex];
      if (!sel) return;
      if ((e.ctrlKey || e.metaKey) && sel.dataset.id) {
        copySecret(sel.dataset.id);
        closePalette();
      } else if (sel.dataset.cmd !== undefined) {
        COMMANDS[parseInt(sel.dataset.cmd)]?.action();
        closePalette();
      } else if (sel.dataset.id) {
        location.href = `/entry/${sel.dataset.id}`;
      }
    }
    return;
  }

  // Don't fire shortcuts when typing in inputs (except above)
  if (isInputFocused() || anyModalOpen) return;

  const cards = getEntryCards();
  const onIndexPage = cards.length > 0 || document.getElementById('entry-list');
  const onDetailPage = !!document.getElementById('delete-form');

  switch (e.key) {
    case '/':
      e.preventDefault();
      searchInput?.focus();
      break;

    case 'n':
    case 'N':
      location.href = '/new';
      break;

    case '?':
      shortcutsModal?.classList.add('active');
      break;

    // Index page shortcuts
    case 'j':
      if (onIndexPage && cards.length) { e.preventDefault(); selectCard(selectedIndex + 1); }
      break;
    case 'k':
      if (onIndexPage && cards.length) { e.preventDefault(); selectCard(selectedIndex - 1); }
      break;
    case 'Enter':
      if (onIndexPage && selectedIndex >= 0 && cards[selectedIndex]) {
        e.preventDefault();
        cards[selectedIndex].click();
      }
      break;
    case 'c':
      if (onIndexPage && selectedIndex >= 0 && cards[selectedIndex]) {
        e.preventDefault();
        copySecret(cards[selectedIndex].dataset.id);
      } else if (onDetailPage) {
        e.preventDefault();
        const secretCopy = document.querySelector('.detail-field:nth-child(2) .copy-btn, .detail-field .copy-btn[data-copy]');
        // Find the secret copy button specifically
        const secretField = document.querySelector('.secret-masked')?.closest('.field-value')?.querySelector('.copy-btn');
        if (secretField) secretField.click();
      }
      break;

    // Detail page shortcuts
    case 'e':
      if (onDetailPage) {
        e.preventDefault();
        document.getElementById('edit-btn')?.click();
      }
      break;
    case 'u':
      if (onDetailPage) {
        e.preventDefault();
        // Copy username from detail page
        const userField = document.querySelector('.detail-field:first-of-type .copy-btn');
        if (userField) userField.click();
      }
      break;
    case 'b':
    case 'Backspace':
      if (onDetailPage) {
        e.preventDefault();
        document.querySelector('.back-link')?.click();
      }
      break;
  }
});
