// ── Clipboard copy ──
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
    showToast('Password generated', 'success');
  });
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
