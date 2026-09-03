let currentPath = '';
let currentUser = { role: null, permissions: [] };
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  if (response.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  return response;
}
async function login(username, password) {
  const res = await apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  return res.json();
}
async function checkAuth() {
  const res = await apiRequest('/check-auth');
  return res.json();
}
function can(permission) {
  return currentUser.role === 'admin' || currentUser.permissions.includes(permission);
}
function isAdmin() {
  return currentUser.role === 'admin';
}
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'];
const VIDEO_EXT = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
const PDF_EXT = ['pdf'];
const ARCHIVE_EXT = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
const DOC_EXT = ['doc', 'docx', 'txt', 'md', 'rtf'];
const CODE_EXT = ['js', 'ts', 'json', 'html', 'css', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'sh', 'yml', 'yaml'];
function ext(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}
function mediaKind(name) {
  const e = ext(name);
  if (IMAGE_EXT.includes(e)) return 'image';
  if (VIDEO_EXT.includes(e)) return 'video';
  if (AUDIO_EXT.includes(e)) return 'audio';
  if (PDF_EXT.includes(e)) return 'pdf';
  return null;
}
const ICONS = {
  folder: '<path d="M3 7a1 1 0 0 1 1-1h4l2 2h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor"/><path d="m5 17 5-5 3.5 3.5L18 11l1 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  video: '<rect x="3" y="5.5" width="14" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M17 10.5 21 8v8l-4-2.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  audio: '<path d="M9 17.5V6l10-2v11.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="16.5" cy="15.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  pdf: '<path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3.5V8h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7.5 12.5h1.4c.7 0 1.2.5 1.2 1.1s-.5 1.1-1.2 1.1H7.5zM11.3 12.5h1.1c.9 0 1.5.7 1.5 1.6s-.6 1.6-1.5 1.6h-1.1zM15 12.5h1.7M15 14.1h1.4M15 12.5v3.2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>',
  archive: '<rect x="4" y="3.5" width="16" height="17" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5v17M10.5 6h3M10.5 9h3M10.5 12h3" stroke="currentColor" stroke-width="1.5"/>',
  doc: '<path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3.5V8h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 12.5h8M8 15.5h8M8 18.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  code: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  file: '<path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3.5V8h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
};
function iconFor(file) {
  if (file.isDirectory) return { svg: ICONS.folder, cls: 'folder-icon' };
  const e = ext(file.name);
  const kind = mediaKind(file.name);
  if (kind) return { svg: ICONS[kind], cls: 'media-icon' };
  if (ARCHIVE_EXT.includes(e)) return { svg: ICONS.archive, cls: '' };
  if (DOC_EXT.includes(e)) return { svg: ICONS.doc, cls: '' };
  if (CODE_EXT.includes(e)) return { svg: ICONS.code, cls: '' };
  return { svg: ICONS.file, cls: '' };
}
function svgIcon(inner, extraClass) {
  return `<span class="file-icon ${extraClass || ''}"><svg viewBox="0 0 24 24" width="19" height="19">${inner}</svg></span>`;
}
function renderGauge(info) {
  const figureEl = document.getElementById('gauge-figure');
  const labelEl = document.getElementById('gauge-label');
  const trackEl = document.getElementById('gauge-track');
  const segWrap = document.getElementById('gauge-segments');
  if (info.total) {
    figureEl.textContent = `${formatBytes(info.used)} of ${formatBytes(info.total)}`;
    const pct = info.percentUsed || 0;
    labelEl.textContent = `${pct.toFixed(1)}% used \u00b7 ${formatBytes(info.free)} free`;
    labelEl.classList.remove('hidden');
    trackEl.classList.remove('hidden');
    const SEGMENTS = 24;
    segWrap.innerHTML = '';
    const filledCount = Math.round((pct / 100) * SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = document.createElement('div');
      seg.className = 'gauge-seg';
      if (i < filledCount) {
        seg.classList.add('filled');
        if (pct >= 90) seg.classList.add('hot');
        else if (pct >= 75) seg.classList.add('warn');
      }
      segWrap.appendChild(seg);
    }
  } else {
    figureEl.textContent = `${formatBytes(info.used)} used`;
    labelEl.textContent = '';
    labelEl.classList.add('hidden');
    trackEl.classList.add('hidden');
  }
}
async function loadFiles() {
  try {
    const encodedPath = encodeURIComponent(currentPath);
    const res = await fetch(`/files/${encodedPath}`);
    const data = await res.json();
    if (data.items) {
      renderFileList(data.items);
    }
    if (data.storage) {
      renderGauge(data.storage);
    }
    renderBreadcrumb();
  } catch (error) {
    console.error('Load files error:', error);
    showMessage('Could not load this folder', true);
  }
}
function renderFileList(files) {
  const container = document.getElementById('file-list-items');
  if (!files || files.length === 0) {
    container.innerHTML = '<div class="empty-state">Nothing here yet' + (isAdmin() ? ' \u2014 upload a file or create a folder.' : '.') + '</div>';
    return;
  }
  let html = '';
  for (const file of files) {
    const icon = iconFor(file);
    const kind = !file.isDirectory ? mediaKind(file.name) : null;
    let nameMarkup;
    if (file.isDirectory) {
      nameMarkup = `<button class="folder-link entry-name" data-path="${escapeHtml(file.path)}">${escapeHtml(file.name)}</button>`;
    } else if (kind) {
      nameMarkup = `<button class="file-name-btn previewable entry-name" data-path="${escapeHtml(file.path)}" data-kind="${kind}">${escapeHtml(file.name)}</button>`;
    } else {
      nameMarkup = `<span class="file-name-static entry-name">${escapeHtml(file.name)}</span>`;
    }
    const actions = [];
    if (kind) actions.push(actionBtn('preview-btn', file.path, iconGlyph('eye'), 'Preview'));
    if (can('download')) {
      const dlHref = `/download/${encodeURIComponent(file.path)}`;
      actions.push(actionLink('download-btn', dlHref, iconGlyph('download'), file.isDirectory ? 'Download as .zip' : 'Download'));
    }
    if (can('share')) actions.push(actionBtn('share-btn', file.path, iconGlyph('link'), file.isDirectory ? 'Share folder' : 'Share'));
    if (isAdmin()) {
      actions.push(actionBtn('rename-btn', file.path, iconGlyph('rename'), 'Rename', file.isDirectory));
      actions.push(actionBtn('delete-btn danger', file.path, iconGlyph('trash'), 'Delete', file.isDirectory));
    }
    html += `
      <div class="file-item" data-path="${escapeHtml(file.path)}">
        <div class="col-name">
          ${svgIcon(icon.svg, icon.cls)}
          ${nameMarkup}
        </div>
        <div class="col-size">${formatBytes(file.size)}</div>
        <div class="action-buttons">${actions.join('')}</div>
      </div>
    `;
  }
  container.innerHTML = html;
  bindFileListEvents();
}
const ACTION_ICONS = {
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 17.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  link: '<path d="M9.5 14.5 14.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 7.5 13 5.6a3.2 3.2 0 0 1 4.5 4.5L15.6 12M13 16.5l-2 1.9a3.2 3.2 0 0 1-4.5-4.5L8.4 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  rename: '<path d="m14.5 5.5 4 4-10 10H4.5v-4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  trash: '<path d="M5 7h14M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M7 7l1 12.5a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9L17 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
};
function iconGlyph(name) {
  return `<svg viewBox="0 0 24 24" width="14" height="14">${ACTION_ICONS[name]}</svg>`;
}
function actionBtn(cls, path, iconSvg, label, isDir) {
  return `<button class="action-btn ${cls}" data-path="${escapeHtml(path)}" data-is-dir="${!!isDir}" title="${label}" aria-label="${label}">${iconSvg}</button>`;
}
function actionLink(cls, href, iconSvg, label) {
  return `<a class="action-btn ${cls}" href="${escapeHtml(href)}" title="${label}" aria-label="${label}">${iconSvg}</a>`;
}
function bindFileListEvents() {
  document.querySelectorAll('.folder-link').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateTo(el.getAttribute('data-path'));
    });
  });
  document.querySelectorAll('.file-name-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openViewer(el.getAttribute('data-path'), el.getAttribute('data-kind'));
    });
  });
  document.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.file-item');
      const nameBtn = row.querySelector('.file-name-btn');
      openViewer(btn.getAttribute('data-path'), nameBtn ? nameBtn.getAttribute('data-kind') : null);
    });
  });
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      shareFile(btn.getAttribute('data-path'));
    });
  });
  document.querySelectorAll('.rename-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = btn.getAttribute('data-path');
      const isDir = btn.getAttribute('data-is-dir') === 'true';
      showRenameModal(path, isDir);
    });
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = btn.getAttribute('data-path');
      const isDir = btn.getAttribute('data-is-dir') === 'true';
      confirmDelete(path, isDir);
    });
  });
}
function navigateTo(path) {
  currentPath = path || '';
  loadFiles();
}
function renderBreadcrumb() {
  const container = document.getElementById('breadcrumb');
  const parts = currentPath.split('/').filter(p => p);
  let html = `<button class="breadcrumb-btn ${parts.length === 0 ? 'current' : ''}" data-path="">Home</button>`;
  let cumulative = '';
  for (let i = 0; i < parts.length; i++) {
    cumulative += (cumulative ? '/' : '') + parts[i];
    const isCurrent = i === parts.length - 1;
    html += `<span class="breadcrumb-sep">/</span><button class="breadcrumb-btn ${isCurrent ? 'current' : ''}" data-path="${escapeHtml(cumulative)}">${escapeHtml(parts[i])}</button>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('.breadcrumb-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-path')));
  });
}
function openViewer(filePath, kind) {
  const name = filePath.split('/').pop();
  const src = `/view/${encodeURIComponent(filePath)}`;
  const modal = document.createElement('div');
  modal.className = 'viewer-modal';
  modal.innerHTML = `
    <div class="viewer-bar">
      <div class="viewer-title">${escapeHtml(name)}</div>
      <div class="viewer-bar-actions">
        ${can('download') ? `<a class="action-btn" id="viewer-download" href="/download/${encodeURIComponent(filePath)}" title="Download" aria-label="Download">${iconGlyph('download')}</a>` : ''}
        <button class="action-btn" id="viewer-close" title="Close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    <div class="viewer-body"></div>
  `;
  const body = modal.querySelector('.viewer-body');
  if (kind === 'image') {
    body.innerHTML = `<img src="${src}" alt="${escapeHtml(name)}">`;
  } else if (kind === 'video') {
    body.innerHTML = `<video src="${src}" controls autoplay></video>`;
  } else if (kind === 'audio') {
    body.innerHTML = `<audio src="${src}" controls autoplay></audio>`;
  } else if (kind === 'pdf') {
    body.innerHTML = `<iframe class="pdf-frame" src="${src}" title="${escapeHtml(name)}"></iframe>`;
  }
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#viewer-close').onclick = close;
  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}
async function shareFile(filePath) {
  const shareUrl = `${window.location.origin}/share/${encodeURIComponent(filePath)}`;
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    }
  } catch (err) {
    copied = false;
  }
  if (copied) {
    showMessage('Link copied to clipboard', false);
  } else {
    showShareFallback(shareUrl);
  }
}
function showShareFallback(shareUrl) {
  document.querySelectorAll('.share-fallback').forEach(el => el.remove());
  const sheet = document.createElement('div');
  sheet.className = 'share-fallback';
  sheet.innerHTML = `
    <p>Couldn't copy automatically \u2014 copy this link to share:</p>
    <div class="share-url-container">
      <input type="text" id="fallback-url" value="${escapeHtml(shareUrl)}" readonly>
      <button class="copy-btn" id="fallback-copy-btn">Copy</button>
    </div>
  `;
  document.body.appendChild(sheet);
  const input = sheet.querySelector('#fallback-url');
  input.focus();
  input.select();
  sheet.querySelector('#fallback-copy-btn').onclick = () => {
    input.select();
    try {
      document.execCommand('copy');
      showMessage('Link copied to clipboard', false);
      sheet.remove();
    } catch (err) {
      input.select();
    }
  };
  setTimeout(() => { if (document.body.contains(sheet)) sheet.remove(); }, 15000);
}
function showModal(title, onSubmit, initialValue = '') {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${escapeHtml(title)}</h3>
      <input type="text" id="modal-input" placeholder="Enter name&hellip;" autocomplete="off" value="${escapeHtml(initialValue)}">
      <div class="modal-buttons">
        <button class="btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn-primary" id="modal-confirm">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const input = modal.querySelector('#modal-input');
  input.focus();
  input.select();
  const cleanup = () => modal.remove();
  const confirm = () => {
    const value = input.value.trim();
    if (value) {
      cleanup();
      onSubmit(value);
    }
  };
  modal.querySelector('#modal-confirm').onclick = confirm;
  modal.querySelector('#modal-cancel').onclick = cleanup;
  input.onkeypress = (e) => { if (e.key === 'Enter') confirm(); };
}
function showRenameModal(oldPath, isDirectory) {
  const oldName = oldPath.split('/').pop();
  showModal(`Rename "${oldName}"`, async (newName) => {
    if (newName === oldName) return;
    try {
      const res = await apiRequest('/rename', {
        method: 'PUT',
        body: JSON.stringify({ oldPath, newName, isDirectory })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Renamed to "${newName}"`, false);
        loadFiles();
      } else {
        showMessage(data.error || 'Rename failed', true);
      }
    } catch (error) {
      showMessage('Rename failed', true);
    }
  }, oldName);
}
function confirmDelete(path, isDirectory) {
  const name = path.split('/').pop();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Delete ${isDirectory ? 'folder' : 'file'}?</h3>
      <p>"${escapeHtml(name)}" will be permanently deleted. This can't be undone.</p>
      <div class="modal-buttons">
        <button class="btn-ghost" id="cancel-delete">Cancel</button>
        <button class="btn-danger" id="confirm-delete">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const cleanup = () => modal.remove();
  modal.querySelector('#cancel-delete').onclick = cleanup;
  modal.querySelector('#confirm-delete').onclick = async () => {
    cleanup();
    try {
      const res = await apiRequest('/delete', {
        method: 'DELETE',
        body: JSON.stringify({ path, isDirectory })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Deleted "${name}"`, false);
        loadFiles();
      } else {
        showMessage(data.error || 'Delete failed', true);
      }
    } catch (error) {
      showMessage('Delete failed', true);
    }
  };
}
function uploadOneFile(file) {
  return new Promise((resolve) => {
    const id = 'up-' + Math.random().toString(36).slice(2);
    addUploadItem(id, file.name);
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('currentPath', currentPath);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        updateUploadItem(id, pct);
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finishUploadItem(id, true);
        resolve({ ok: true, name: file.name });
      } else {
        let message = 'Upload failed';
        try { message = JSON.parse(xhr.responseText).error || message; } catch (err) {  }
        finishUploadItem(id, false, message);
        resolve({ ok: false, name: file.name, error: message });
      }
    });
    xhr.addEventListener('error', () => {
      finishUploadItem(id, false, 'Upload failed');
      resolve({ ok: false, name: file.name, error: 'Upload failed' });
    });
    xhr.open('POST', '/upload');
    xhr.send(formData);
  });
}
async function uploadFiles(files) {
  for (const file of files) {
    const result = await uploadOneFile(file);
    if (result.ok) {
      showMessage(`Uploaded ${result.name}`, false);
    } else {
      showMessage(`Failed to upload ${result.name}: ${result.error}`, true);
    }
  }
  loadFiles();
}
function getUploadTray() {
  const tray = document.getElementById('upload-tray');
  tray.classList.remove('hidden');
  return tray;
}
function addUploadItem(id, name) {
  const tray = getUploadTray();
  const item = document.createElement('div');
  item.className = 'upload-item';
  item.id = id;
  item.innerHTML = `
    <div class="upload-item-top">
      <span class="upload-item-name">${escapeHtml(name)}</span>
      <span class="upload-item-pct">0%</span>
    </div>
    <div class="upload-item-bar"><div class="upload-item-fill"></div></div>
  `;
  tray.appendChild(item);
}
function updateUploadItem(id, pct) {
  const item = document.getElementById(id);
  if (!item) return;
  item.querySelector('.upload-item-fill').style.width = pct + '%';
  item.querySelector('.upload-item-pct').textContent = pct + '%';
}
function finishUploadItem(id, success, errorMsg) {
  const item = document.getElementById(id);
  if (!item) return;
  if (success) {
    item.classList.add('done');
    item.querySelector('.upload-item-fill').style.width = '100%';
    item.querySelector('.upload-item-pct').textContent = 'Done';
    setTimeout(() => {
      item.remove();
      const tray = document.getElementById('upload-tray');
      if (tray && !tray.children.length) tray.classList.add('hidden');
    }, 1800);
  } else {
    item.classList.add('error');
    item.querySelector('.upload-item-pct').textContent = errorMsg || 'Failed';
    setTimeout(() => {
      item.remove();
      const tray = document.getElementById('upload-tray');
      if (tray && !tray.children.length) tray.classList.add('hidden');
    }, 5000);
  }
}
async function createFolder() {
  showModal('New folder', async (name) => {
    try {
      const res = await apiRequest('/create-folder', {
        method: 'POST',
        body: JSON.stringify({ folderName: name, currentPath })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Created "${name}"`, false);
        loadFiles();
      } else {
        showMessage(data.error || 'Could not create folder', true);
      }
    } catch (error) {
      showMessage('Could not create folder', true);
    }
  });
}
async function openSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content settings-content">
      <h3>Settings</h3>
      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="storage">Storage</button>
        <button class="settings-tab" data-tab="sharing">Sharing</button>
        <button class="settings-tab" data-tab="users">Subusers</button>
      </div>
      <div class="settings-panel active" data-panel="storage">
        <div class="settings-row">
          <label class="row-label" for="setting-total-space">Total storage space (MB)</label>
          <input type="number" id="setting-total-space" min="1" placeholder="No limit set">
          <div class="settings-hint">Sets a hard upload limit and shows usage as a percentage. Leave blank to just show how much space is used, with no limit enforced.</div>
        </div>
        <div class="settings-save-row"><button class="btn-primary" id="save-storage-settings">Save</button></div>
      </div>
      <div class="settings-panel" data-panel="sharing">
        <div class="settings-row">
          <label class="check-row"><input type="checkbox" id="setting-caption-enabled"> Show a caption under shared photos, videos, audio, and PDFs</label>
        </div>
        <div class="settings-row">
          <label class="row-label" for="setting-caption-text">Caption text</label>
          <textarea id="setting-caption-text" data-vlt="caption"></textarea>
          <div class="settings-hint">Use {type} for Photo/Video/Audio/PDF and {filename} for the file name.</div>
        </div>
        <div class="settings-save-row"><button class="btn-primary" id="save-sharing-settings">Save</button></div>
      </div>
      <div class="settings-panel" data-panel="users">
        <div class="settings-subheading">Existing subusers</div>
        <div class="user-list" id="user-list"><div class="settings-hint">Loading&hellip;</div></div>
        <div class="settings-divider"></div>
        <div class="settings-subheading">Create a subuser</div>
        <div class="settings-row">
          <label class="row-label" for="new-user-username">Username</label>
          <input type="text" id="new-user-username" autocomplete="off">
        </div>
        <div class="settings-row">
          <label class="row-label" for="new-user-password">Password</label>
          <input type="password" id="new-user-password" autocomplete="new-password">
        </div>
        <div class="settings-row">
          <div class="row-label">Permissions</div>
          <div class="perm-checks">
            <label class="check-row"><input type="checkbox" id="new-user-download"> Download</label>
            <label class="check-row"><input type="checkbox" id="new-user-share"> Share</label>
          </div>
          <div class="settings-hint">Subusers can always browse files. They can never upload, rename, or delete anything.</div>
        </div>
        <div class="settings-save-row"><button class="btn-primary" id="create-user-btn">Create subuser</button></div>
      </div>
      <div class="modal-buttons">
        <button class="btn-ghost" id="close-settings" style="flex:1">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      modal.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      modal.querySelector(`.settings-panel[data-panel="${tab.getAttribute('data-tab')}"]`).classList.add('active');
    });
  });
  modal.querySelector('#close-settings').onclick = () => modal.remove();
  try {
    const res = await apiRequest('/settings');
    const settings = await res.json();
    modal.querySelector('#setting-total-space').value = settings.totalSpaceMB || '';
    modal.querySelector('#setting-caption-enabled').checked = !!settings.shareCaptionEnabled;
    modal.querySelector('#setting-caption-text').value = settings.shareCaptionText || '';
  } catch (err) {
    showMessage('Could not load settings', true);
  }
  modal.querySelector('#save-storage-settings').onclick = async () => {
    const val = modal.querySelector('#setting-total-space').value.trim();
    try {
      const res = await apiRequest('/settings', {
        method: 'POST',
        body: JSON.stringify({ totalSpaceMB: val === '' ? null : val })
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Storage settings saved', false);
        loadFiles();
      } else {
        showMessage(data.error || 'Could not save', true);
      }
    } catch (err) {
      showMessage('Could not save settings', true);
    }
  };
  modal.querySelector('#save-sharing-settings').onclick = async () => {
    try {
      const res = await apiRequest('/settings', {
        method: 'POST',
        body: JSON.stringify({
          shareCaptionEnabled: modal.querySelector('#setting-caption-enabled').checked,
          shareCaptionText: modal.querySelector('#setting-caption-text').value
        })
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Sharing settings saved', false);
      } else {
        showMessage(data.error || 'Could not save', true);
      }
    } catch (err) {
      showMessage('Could not save settings', true);
    }
  };
  modal.querySelector('#create-user-btn').onclick = async () => {
    const username = modal.querySelector('#new-user-username').value.trim();
    const password = modal.querySelector('#new-user-password').value;
    const permissions = [];
    if (modal.querySelector('#new-user-download').checked) permissions.push('download');
    if (modal.querySelector('#new-user-share').checked) permissions.push('share');
    try {
      const res = await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, permissions })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Created subuser "${username}"`, false);
        modal.querySelector('#new-user-username').value = '';
        modal.querySelector('#new-user-password').value = '';
        modal.querySelector('#new-user-download').checked = false;
        modal.querySelector('#new-user-share').checked = false;
        loadUserList(modal);
      } else {
        showMessage(data.error || 'Could not create subuser', true);
      }
    } catch (err) {
      showMessage('Could not create subuser', true);
    }
  };
  loadUserList(modal);
}
async function loadUserList(modal) {
  const listEl = modal.querySelector('#user-list');
  try {
    const res = await apiRequest('/users');
    const data = await res.json();
    const users = data.users || [];
    if (!users.length) {
      listEl.innerHTML = '<div class="settings-hint">No subusers yet.</div>';
      return;
    }
    listEl.innerHTML = users.map(u => `
      <div class="user-row">
        <div>
          <div class="user-row-name">${escapeHtml(u.username)}</div>
          <div class="user-row-perms">${u.permissions.join(', ')}</div>
        </div>
        <button class="user-row-del" data-username="${escapeHtml(u.username)}" title="Delete" aria-label="Delete subuser">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 7h14M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M7 7l1 12.5a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9L17 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `).join('');
    listEl.querySelectorAll('.user-row-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = btn.getAttribute('data-username');
        try {
          const res = await apiRequest(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            showMessage(`Removed "${username}"`, false);
            loadUserList(modal);
          } else {
            showMessage(data.error || 'Could not remove subuser', true);
          }
        } catch (err) {
          showMessage('Could not remove subuser', true);
        }
      });
    });
  } catch (err) {
    listEl.innerHTML = '<div class="settings-hint">Could not load subusers.</div>';
  }
}
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  document.getElementById('theme-icon-dark').classList.toggle('hidden', theme === 'light');
  document.getElementById('theme-icon-light').classList.toggle('hidden', theme !== 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f2ec' : '#12141c');
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  localStorage.setItem('vault-theme', next);
  applyTheme(next);
}
function formatBytes(bytes) {
  if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function showMessage(msg, isError = true) {
  document.querySelectorAll('.toast-message').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast-message ${isError ? 'error' : ''}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
async function logout() {
  await apiRequest('/logout', { method: 'POST' });
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('login-container').classList.remove('hidden');
  currentPath = '';
  currentUser = { role: null, permissions: [] };
}
function applyPermissionUI() {
  document.getElementById('settings-btn').classList.toggle('hidden', !isAdmin());
  document.getElementById('create-folder-btn').classList.toggle('hidden', !isAdmin());
  document.getElementById('upload-area').classList.toggle('hidden', !isAdmin());
}
async function init() {
  const auth = await checkAuth();
  if (auth.authenticated) {
    currentUser = { role: auth.role, permissions: auth.permissions || [] };
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    applyPermissionUI();
    await loadFiles();
  } else {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
  }
}
applyTheme(localStorage.getItem('vault-theme') === 'light' ? 'light' : 'dark');
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const result = await login(username, password);
    if (result.success) {
      init();
    } else {
      document.getElementById('login-error').textContent = 'Wrong username or password';
      document.getElementById('login-error').classList.remove('hidden');
    }
  } catch (error) {
    document.getElementById('login-error').textContent = 'Sign in failed';
    document.getElementById('login-error').classList.remove('hidden');
  }
});
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('create-folder-btn').addEventListener('click', createFolder);
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files.length) {
    uploadFiles(Array.from(e.target.files));
    e.target.value = '';
  }
});
const dropOverlay = document.getElementById('drop-overlay');
let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
  if (document.getElementById('app-container').classList.contains('hidden')) return;
  if (!isAdmin()) return;
  if (!e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  dragCounter++;
  dropOverlay.classList.remove('hidden');
});
document.addEventListener('dragover', (e) => {
  if (!isAdmin()) return;
  if (!e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
});
document.addEventListener('dragleave', (e) => {
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) dropOverlay.classList.add('hidden');
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.add('hidden');
  if (document.getElementById('app-container').classList.contains('hidden')) return;
  if (!isAdmin()) return;
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length) uploadFiles(files);
});
init();
