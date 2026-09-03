const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const decodeBrand = values => String.fromCharCode(...values.map(value => value ^ 90));
const BRAND = Object.freeze({
  name: decodeBrand([12,59,47,54,46]),
  owner: decodeBrand([12,63,40,46,53,41]),
  by: decodeBrand([12,59,47,54,46,122,56,35,122,12,63,40,46,53,41]),
  site: decodeBrand([12,59,47,54,46,122,38,122,10,53,45,63,40,63,62,122,56,35,122,12,63,40,46,53,41,116,51,52]),
  caption: decodeBrand([33,46,35,42,63,39,122,237,122,12,59,47,54,46,122,56,35,122,12,63,40,46,53,41]),
  running: decodeBrand([10057,122,12,59,47,54,46,122,56,35,122,12,63,40,46,53,41,122,51,41,122,40,47,52,52,51,52,61])
});
const PROTECTED_UI_HASH = '96abea637d9ca5007407026eb4722c60217f48a06661c071dc3e4f101082a209';
const PROTECTED_BRAND_HASH = '7e9bbbcc2ed462dcb13cc3c46027ed8abb63b0907af6c1640ecdc7ff4c7a8200';
function verifyBrandIntegrity() {
  const uiPath = path.join(__dirname, 'public', 'vui.js');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const notFoundPath = path.join(__dirname, 'public', '404.html');
  const appPath = path.join(__dirname, 'public', 'app.js');
  try {
    const uiHash = crypto.createHash('sha256').update(fs.readFileSync(uiPath)).digest('hex');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const notFoundHtml = fs.readFileSync(notFoundPath, 'utf8');
    const appJs = fs.readFileSync(appPath, 'utf8');
    const indexTokens = ['data-vlt="login"', 'data-vlt="wordmark"', 'src="/vui.js"'];
    const notFoundTokens = ['data-vlt-page="404"', 'data-vlt="footer"', 'src="/vui.js"'];
    const protectedFooter = /<footer\b[^>]*class=["'][^"']*\bfooter\b[^"']*["'][^>]*>[\s\S]*?data-vlt=["']footer["'][\s\S]*?<\/footer>/i;
    const brandHash = crypto.createHash('sha256').update(Object.values(BRAND).join('\0')).digest('hex');
    if (uiHash !== PROTECTED_UI_HASH || brandHash !== PROTECTED_BRAND_HASH || indexTokens.some(token => !indexHtml.includes(token)) || !protectedFooter.test(indexHtml) || notFoundTokens.some(token => !notFoundHtml.includes(token)) || !appJs.includes('data-vlt="caption"')) throw new Error('protected attribution files were modified');
  } catch (err) {
    console.error(`\x1b[31mBrand integrity check failed: ${err.message}. Restore the original protected attribution files.\x1b[0m`);
    process.exit(78);
  }
}
function watchBrandIntegrity() {
  ['vui.js', 'index.html', '404.html', 'app.js'].forEach(file => {
    const target = path.join(__dirname, 'public', file);
    fs.watchFile(target, { interval: 1000, persistent: false }, (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs || current.size !== previous.size) verifyBrandIntegrity();
    });
  });
}
verifyBrandIntegrity();
watchBrandIntegrity();
const ENV_PATH = path.join(__dirname, '.env');
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'changeme';
let FIRST_RUN = false;
function generateSessionSecret() {
  return crypto.randomBytes(48).toString('hex');
}
function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return;
  const generatedSecret = generateSessionSecret();
  const contents = `PORT=3000\nADMIN_USERNAME=${DEFAULT_ADMIN_USERNAME}\nADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}\nSESSION_SECRET=${generatedSecret}\nMAX_FILE_SIZE=5368709120\n`;
  try {
    fs.writeFileSync(ENV_PATH, contents, { flag: 'wx', mode: 0o600 });
    FIRST_RUN = true;
  } catch (err) {
    if (!fs.existsSync(ENV_PATH)) {
      console.error(`\x1b[31mFailed to create .env: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  }
}
function ensureSessionSecret() {
  if (process.env.SESSION_SECRET) return;
  const generatedSecret = generateSessionSecret();
  try {
    fs.appendFileSync(
      ENV_PATH,
      `\nSESSION_SECRET=${generatedSecret}\n`,
      { mode: 0o600 }
    );
    process.env.SESSION_SECRET = generatedSecret;
  } catch (err) {
    console.error(`\x1b[31mFailed to persist SESSION_SECRET: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}
ensureEnvFile();
require('dotenv').config({ path: ENV_PATH });
ensureSessionSecret();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const archiver = require('archiver');
const db = require('./db');
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const PORT_SOURCE = process.env.SERVER_PORT
  ? 'Pterodactyl allocation (SERVER_PORT)'
  : process.env.PORT
    ? '.env (PORT)'
    : 'default';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 104857600;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DEFAULT_CAPTION_TEMPLATE = BRAND.caption;
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 86400000
  }
}));
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${random}-${sanitized}`);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE }
});
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.session.role === 'admin' || (req.session.permissions || []).includes(permission)) {
      return next();
    }
    return res.status(403).json({ error: 'You do not have permission to do that' });
  };
}
function resolveSafePath(rawPath) {
  let cleaned;
  try {
    cleaned = decodeURIComponent(rawPath || '');
  } catch {
    return null;
  }
  if (cleaned.startsWith('/')) cleaned = cleaned.substring(1);
  const fullPath = path.join(UPLOAD_DIR, cleaned);
  const normalizedRoot = path.join(UPLOAD_DIR, path.sep);
  if (fullPath !== UPLOAD_DIR && !fullPath.startsWith(normalizedRoot)) {
    return null;
  }
  return fullPath;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function sendNotFoundPage(res) {
  return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
}
function formatBytesServer(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'];
const VIDEO_EXT = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
const PDF_EXT = ['pdf'];
function mediaKindOf(name) {
  const e = path.extname(name).slice(1).toLowerCase();
  if (IMAGE_EXT.includes(e)) return 'image';
  if (VIDEO_EXT.includes(e)) return 'video';
  if (AUDIO_EXT.includes(e)) return 'audio';
  if (PDF_EXT.includes(e)) return 'pdf';
  return null;
}
function getMimeType(name) {
  const e = path.extname(name).slice(1).toLowerCase();
  const mimeTypes = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime', m4v: 'video/x-m4v',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac',
    pdf: 'application/pdf'
  };
  return mimeTypes[e] || 'application/octet-stream';
}
function calculateDirSize(dirPath) {
  let totalSize = 0;
  const walk = (dir) => {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) walk(itemPath);
        else totalSize += stat.size;
      }
    } catch (err) {
      console.error('Error calculating size:', err);
    }
  };
  walk(dirPath);
  return totalSize;
}
function calculateTotalStorage() {
  return calculateDirSize(UPLOAD_DIR);
}
async function getStorageInfo() {
  const used = calculateTotalStorage();
  let total = null;
  const settingMB = parseInt(await db.getSetting('total_space_mb', ''), 10);
  if (!isNaN(settingMB) && settingMB > 0) {
    total = settingMB * 1024 * 1024;
  }
  const free = total !== null ? Math.max(total - used, 0) : null;
  const percentUsed = total ? Math.min(100, (used / total) * 100) : null;
  return { used, total, free, percentUsed };
}
function streamZipOfDirectory(res, dirPath, zipName) {
  res.attachment(zipName);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('Zip stream error:', err);
    if (!res.headersSent) res.status(500);
    res.end();
  });
  archive.pipe(res);
  archive.directory(dirPath, path.basename(dirPath));
  archive.finalize();
}
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username && password && username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD) {
    req.session.userId = username;
    req.session.role = 'admin';
    req.session.permissions = ['view', 'download', 'share'];
    return res.json({ success: true, role: 'admin', permissions: req.session.permissions });
  }
  try {
    const user = username ? await db.getUser(username) : null;
    if (user && bcrypt.compareSync(password || '', user.passwordHash)) {
      req.session.userId = user.username;
      req.session.role = 'subuser';
      req.session.permissions = user.permissions;
      return res.json({ success: true, role: 'subuser', permissions: user.permissions });
    }
  } catch (err) {
    console.error('Login lookup error:', err);
  }
  res.status(401).json({ error: 'Invalid credentials' });
});
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});
app.get('/check-auth', (req, res) => {
  res.json({
    authenticated: !!req.session.userId,
    role: req.session.role || null,
    permissions: req.session.permissions || []
  });
});
app.get('/storage', requirePermission('view'), async (req, res) => {
  res.json(await getStorageInfo());
});
app.get('/files/*', requirePermission('view'), async (req, res) => {
  const filePath = decodeURIComponent(req.params[0] || '').replace(/^\/+/, '');
  const fullPath = resolveSafePath(filePath);
  if (!fullPath) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const files = fs.readdirSync(fullPath);
      const items = [];
      for (const file of files) {
        const itemPath = path.join(fullPath, file);
        const itemStat = fs.statSync(itemPath);
        const relativePath = filePath ? path.join(filePath, file) : file;
        const isDir = itemStat.isDirectory();
        items.push({
          name: file,
          path: relativePath.split(path.sep).join('/'),
          isDirectory: isDir,
          size: isDir ? calculateDirSize(itemPath) : itemStat.size,
          modified: itemStat.mtime
        });
      }
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      res.json({
        currentPath: filePath,
        items: items,
        storage: await getStorageInfo()
      });
    } else {
      res.json({
        isFile: true,
        path: filePath,
        size: stat.size
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const cleanup = () => { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); };
  const info = await getStorageInfo();
  if (info.total !== null && (info.used + req.file.size) > info.total) {
    cleanup();
    return res.status(400).json({ error: 'Not enough storage space available' });
  }
  const targetPath = req.body.currentPath || '';
  const targetDir = resolveSafePath(targetPath);
  const originalFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (!targetDir) {
    cleanup();
    return res.status(403).json({ error: 'Forbidden' });
  }
  const targetFile = path.join(targetDir, originalFilename);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  try {
    let finalPath = targetFile;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(originalFilename);
      const basename = path.basename(originalFilename, ext);
      finalPath = path.join(targetDir, `${basename} (${counter})${ext}`);
      counter++;
    }
    fs.renameSync(req.file.path, finalPath);
    res.json({
      success: true,
      file: {
        name: path.basename(finalPath),
        path: targetPath ? path.join(targetPath, path.basename(finalPath)) : path.basename(finalPath)
      }
    });
  } catch (error) {
    cleanup();
    res.status(500).json({ error: 'Failed to save file' });
  }
});
app.get('/download/*', requirePermission('download'), (req, res) => {
  const fullPath = resolveSafePath(req.params[0]);
  if (!fullPath) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('File not found');
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    return streamZipOfDirectory(res, fullPath, `${path.basename(fullPath)}.zip`);
  }
  res.download(fullPath, path.basename(fullPath));
});
app.get('/view/*', requirePermission('view'), (req, res) => {
  const fullPath = resolveSafePath(req.params[0]);
  if (!fullPath) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return res.status(404).send('File not found');
  }
  res.sendFile(fullPath);
});
function renderFolderSharePage(req, res, fullPath) {
  let items = [];
  try {
    items = fs.readdirSync(fullPath).map(name => {
      const p = path.join(fullPath, name);
      const st = fs.statSync(p);
      const isDir = st.isDirectory();
      return { name, isDirectory: isDir, size: isDir ? calculateDirSize(p) : st.size };
    });
  } catch (err) {
    return res.status(500).send('Could not read this folder');
  }
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const basePath = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  const baseUrl = `${protocol}://${host}${basePath}`;
  const folderName = path.basename(fullPath);
  const rows = items.length
    ? items.map(item => {
        const itemUrl = `${baseUrl}/${encodeURIComponent(item.name)}`;
        const icon = item.isDirectory
          ? '<path d="M3 7a1 1 0 0 1 1-1h4l2 2h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.5"/>'
          : '<path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3.5V8h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
        return `
        <div class="row">
          <a class="row-name" href="${escapeHtml(itemUrl)}">
            <svg viewBox="0 0 24 24" width="18" height="18" class="${item.isDirectory ? 'folder-ic' : ''}">${icon}</svg>
            <span>${escapeHtml(item.name)}</span>
          </a>
          <span class="row-size">${formatBytesServer(item.size)}</span>
          <a class="row-dl" href="${escapeHtml(itemUrl)}?dl=1">Download</a>
        </div>`;
      }).join('')
    : '<div class="empty">This folder is empty.</div>';
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(folderName)}</title>
<meta property="og:title" content="${escapeHtml(folderName)}">
<meta property="og:site_name" content="${escapeHtml(BRAND.site)}">
<meta property="og:url" content="${escapeHtml(baseUrl)}">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 32px 18px;
    background: #0f1117; color: #edeff5;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    display: flex; justify-content: center;
  }
  .wrap { width: 100%; max-width: 620px; }
  h1 { font-size: 19px; font-weight: 600; margin: 0 0 4px; word-break: break-word; }
  .sub { font-size: 12px; color: #5b6379; margin-bottom: 18px; font-family: 'IBM Plex Mono', monospace; }
  .dl-all {
    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 18px;
    background: #d9a441; color: #1b1404; text-decoration: none; font-weight: 500;
    font-size: 13px; padding: 9px 16px; border-radius: 6px;
  }
  .dl-all:hover { background: #e5b256; }
  .list { border: 1px solid #262b39; border-radius: 12px; overflow: hidden; background: #171a24; }
  .row { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-bottom: 1px solid #1e2230; font-size: 13.5px; }
  .row:last-child { border-bottom: none; }
  .row-name { flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; color: #edeff5; text-decoration: none; overflow: hidden; }
  .row-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'IBM Plex Mono', monospace; font-size: 13px; }
  .row-name:hover { color: #d9a441; }
  .row-name svg { flex-shrink: 0; color: #8991a8; }
  .row-name svg.folder-ic { color: #d9a441; }
  .row-size { color: #5b6379; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; width: 70px; text-align: right; flex-shrink: 0; }
  .row-dl { color: #8991a8; text-decoration: none; font-size: 11.5px; flex-shrink: 0; border: 1px solid #262b39; padding: 5px 10px; border-radius: 5px; }
  .row-dl:hover { color: #d9a441; border-color: #a9862f; }
  .empty { padding: 40px 20px; text-align: center; color: #5b6379; font-size: 13px; }
  .footer-note { margin-top: 18px; text-align: center; font-size: 11px; color: #5b6379; }
  @media (max-width: 420px) { .row-size { display: none; } }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(folderName)}</h1>
    <div class="sub">Shared folder \u00b7 ${items.length} item${items.length === 1 ? '' : 's'}</div>
    <a class="dl-all" href="${escapeHtml(baseUrl)}?dl=1">Download folder (.zip)</a>
    <div class="list">${rows}</div>
    <div class="footer-note">${escapeHtml(BRAND.by)}</div>
  </div>
</body>
</html>`);
}
app.get('/share/*', async (req, res) => {
  const fullPath = resolveSafePath(req.params[0]);
  if (!fullPath) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(fullPath)) {
    return sendNotFoundPage(res);
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    if (fullPath === UPLOAD_DIR) {
      return res.status(403).send('The root folder cannot be shared - share a specific folder instead.');
    }
    if (req.query.dl === '1') {
      return streamZipOfDirectory(res, fullPath, `${path.basename(fullPath)}.zip`);
    }
    return renderFolderSharePage(req, res, fullPath);
  }
  const name = path.basename(fullPath);
  if (req.query.raw === '1') {
    res.set('Content-Type', getMimeType(name));
    res.set('Content-Disposition', 'inline');
    return res.sendFile(fullPath);
  }
  const kind = mediaKindOf(name);
  if (req.query.dl === '1' || !kind) {
    return res.download(fullPath, name);
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const basePath = req.originalUrl.split('?')[0];
  const absoluteBaseUrl = `${protocol}://${host}${basePath}`;
  const rawUrl = `${absoluteBaseUrl}?raw=1`;
  const dlUrl = `${absoluteBaseUrl}?dl=1`;
  const mimeType = getMimeType(name);
  let captionHtml = '';
  try {
    const enabled = (await db.getSetting('share_caption_enabled', '0')) === '1';
    if (enabled) {
      const template = await db.getSetting('share_caption_text', DEFAULT_CAPTION_TEMPLATE) || DEFAULT_CAPTION_TEMPLATE;
      const typeLabel = kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : 'PDF';
      const text = template.replace(/\{type\}/g, typeLabel).replace(/\{filename\}/g, name);
      captionHtml = `<p class="caption">${escapeHtml(text)}</p>`;
    }
  } catch (err) {
    console.error('Caption lookup error:', err);
  }
  let mediaTag = '';
  if (kind === 'image') mediaTag = `<img src="${escapeHtml(rawUrl)}" alt="${escapeHtml(name)}">`;
  if (kind === 'video') mediaTag = `<video src="${escapeHtml(rawUrl)}" controls playsinline preload="metadata"></video>`;
  if (kind === 'audio') mediaTag = `<audio src="${escapeHtml(rawUrl)}" controls preload="metadata"></audio>`;
  if (kind === 'pdf') mediaTag = `<embed src="${escapeHtml(rawUrl)}" type="application/pdf" class="pdf-embed">`;
  let socialMeta = '';
  if (kind === 'image') {
    socialMeta = `
<meta property="og:type" content="website">
<meta property="og:image" content="${escapeHtml(rawUrl)}">
<meta property="og:image:secure_url" content="${escapeHtml(rawUrl)}">
<meta property="og:image:type" content="${escapeHtml(mimeType)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHtml(rawUrl)}">
`;
  } else if (kind === 'video') {
    socialMeta = `
<meta property="og:type" content="video.other">
<meta property="og:video" content="${escapeHtml(rawUrl)}">
<meta property="og:video:secure_url" content="${escapeHtml(rawUrl)}">
<meta property="og:video:type" content="${escapeHtml(mimeType)}">
<meta property="og:video:width" content="1280">
<meta property="og:video:height" content="720">
<meta name="twitter:card" content="player">
<meta name="twitter:player" content="${escapeHtml(absoluteBaseUrl)}">
<meta name="twitter:player:stream" content="${escapeHtml(rawUrl)}">
<meta name="twitter:player:stream:content_type" content="${escapeHtml(mimeType)}">
`;
  } else if (kind === 'audio') {
    socialMeta = `
<meta property="og:type" content="music.song">
<meta property="og:audio" content="${escapeHtml(rawUrl)}">
<meta property="og:audio:type" content="${escapeHtml(mimeType)}">
<meta name="twitter:card" content="summary">
`;
  }
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(name)}</title>
<meta property="og:title" content="${escapeHtml(name)}">
<meta property="og:url" content="${escapeHtml(absoluteBaseUrl)}">
<meta property="og:site_name" content="${escapeHtml(BRAND.site)}">
${socialMeta}
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px; padding: 24px;
    background: #0f1117; color: #edeff5;
    font-family: 'Space Grotesk', system-ui, sans-serif;
  }
  .media-wrap { max-width: min(92vw, 760px); width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  img, video { max-width: 100%; max-height: 76vh; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  audio { width: 100%; min-width: 280px; }
  .pdf-embed { width: 100%; height: 80vh; border: none; border-radius: 12px; background: #fff; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .caption { font-size: 13px; color: #8991a8; text-align: center; margin: 0; }
  .dl-link {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 4px;
    background: #d9a441; color: #1b1404; text-decoration: none; font-weight: 500;
    font-size: 13px; padding: 9px 16px; border-radius: 6px;
  }
  .dl-link:hover { background: #e5b256; }
  .filename { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #5b6379; }
</style>
</head>
<body>
  <div class="media-wrap">
    ${mediaTag}
    ${captionHtml}
  </div>
  <span class="filename">${escapeHtml(name)}</span>
  <a class="dl-link" href="${escapeHtml(dlUrl)}">Download</a>
</body>
</html>`);
});
app.post('/create-folder', requireAdmin, async (req, res) => {
  const { currentPath, folderName } = req.body;
  if (!folderName || folderName.match(/[\\/]/) || folderName.includes('..')) {
    return res.status(400).json({ error: 'Invalid folder name' });
  }
  const folderPath = resolveSafePath(path.join(currentPath || '', folderName));
  if (!folderPath) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (fs.existsSync(folderPath)) {
    return res.status(400).json({ error: 'Folder already exists' });
  }
  try {
    fs.mkdirSync(folderPath, { recursive: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});
app.put('/rename', requireAdmin, async (req, res) => {
  const { oldPath, newName } = req.body;
  if (!newName || newName.match(/[\\/]/) || newName.includes('..')) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  const oldFullPath = resolveSafePath(oldPath);
  if (!oldFullPath || !fs.existsSync(oldFullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const newFullPath = path.join(path.dirname(oldFullPath), newName);
  const normalizedRoot = path.join(UPLOAD_DIR, path.sep);
  if (newFullPath !== UPLOAD_DIR && !newFullPath.startsWith(normalizedRoot)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (fs.existsSync(newFullPath)) {
    return res.status(400).json({ error: 'Name already exists' });
  }
  try {
    fs.renameSync(oldFullPath, newFullPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Rename failed' });
  }
});
app.delete('/delete', requireAdmin, async (req, res) => {
  const { path: itemPath } = req.body;
  const fullPath = resolveSafePath(itemPath);
  if (!fullPath) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (fullPath === UPLOAD_DIR) {
    return res.status(400).json({ error: 'The storage root cannot be deleted' });
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const deleteRecursive = (p) => {
    if (fs.statSync(p).isDirectory()) {
      fs.readdirSync(p).forEach(file => {
        deleteRecursive(path.join(p, file));
      });
      fs.rmdirSync(p);
    } else {
      fs.unlinkSync(p);
    }
  };
  try {
    deleteRecursive(fullPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/settings', requireAdmin, async (req, res) => {
  const settings = await db.getAllSettings();
  res.json({
    totalSpaceMB: settings.total_space_mb ? parseInt(settings.total_space_mb, 10) : null,
    shareCaptionEnabled: settings.share_caption_enabled === '1',
    shareCaptionText: settings.share_caption_text || DEFAULT_CAPTION_TEMPLATE
  });
});
app.post('/settings', requireAdmin, async (req, res) => {
  const { totalSpaceMB, shareCaptionEnabled, shareCaptionText } = req.body;
  try {
    if (totalSpaceMB !== undefined) {
      if (totalSpaceMB === null || totalSpaceMB === '') {
        await db.setSetting('total_space_mb', '');
      } else {
        const mb = parseInt(totalSpaceMB, 10);
        if (isNaN(mb) || mb <= 0) {
          return res.status(400).json({ error: 'Total space must be a positive number of MB' });
        }
        await db.setSetting('total_space_mb', mb);
      }
    }
    if (shareCaptionEnabled !== undefined) {
      await db.setSetting('share_caption_enabled', shareCaptionEnabled ? '1' : '0');
    }
    if (shareCaptionText !== undefined) {
      await db.setSetting('share_caption_text', shareCaptionText || DEFAULT_CAPTION_TEMPLATE);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});
const ASSIGNABLE_PERMISSIONS = ['share', 'download'];
app.get('/users', requireAdmin, async (req, res) => {
  res.json({ users: await db.listUsers() });
});
app.post('/users', requireAdmin, async (req, res) => {
  const { username, password, permissions } = req.body;
  if (!username || username.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username must be at least 3 characters (letters, numbers, _ . -)' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  if (username === process.env.ADMIN_USERNAME) {
    return res.status(400).json({ error: 'That username is already in use' });
  }
  try {
    const existing = await db.getUser(username);
    if (existing) {
      return res.status(400).json({ error: 'That username is already in use' });
    }
    const perms = ['view', ...(Array.isArray(permissions) ? permissions.filter(p => ASSIGNABLE_PERMISSIONS.includes(p)) : [])];
    const hash = bcrypt.hashSync(password, 10);
    await db.createUser(username, hash, perms);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});
app.delete('/users/:username', requireAdmin, async (req, res) => {
  try {
    await db.deleteUser(req.params.username);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
setInterval(() => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 3600000) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (err) {
    console.error('Temp cleanup error:', err);
  }
}, 3600000);
app.use((req, res) => {
  const apiPrefixes = ['/login', '/logout', '/check-auth', '/storage', '/files/', '/upload', '/download/', '/view/', '/create-folder', '/rename', '/delete', '/settings', '/users'];
  const wantsJson = apiPrefixes.some(prefix => req.path === prefix || req.path.startsWith(prefix));
  if (wantsJson) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large. Maximum size is ${formatBytesServer(MAX_FILE_SIZE)}.`
      : err.message;
    return res.status(400).json({ error: message });
  }
  return res.status(500).json({ error: 'Internal server error' });
});
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};
function color(colorName, text) {
  return `${C[colorName]}${text}${C.reset}`;
}
function printStartupInfo() {
  const usingDefaultCredentials =
    process.env.ADMIN_USERNAME === DEFAULT_ADMIN_USERNAME ||
    process.env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD;
  console.log('');
  console.log(color('green', `${C.bold}${BRAND.running}${C.reset}`));
  console.log(color('cyan', `  Listening on port ${PORT}`));
  if (FIRST_RUN) {
    console.log(color('green', '  [MSG] - First-run setup complete: .env was created automatically.'));
  }
  if (usingDefaultCredentials) {
    console.log('');
    console.log(color('green', '  [MSG] - Running it for the first time? Change the default credentials in .env'));
    console.log(color('yellow', '  [WARN] - Default admin credentials are still active: admin / changeme'));
    console.log(color('yellow', '  [WARN] - Restart the server after editing .env.'));
  } else {
    console.log(color('green', '  [MSG] - Custom admin credentials detected.'));
  }
  console.log('');
}
app.listen(PORT, () => {
  printStartupInfo();
});
