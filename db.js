const path = require('path');
const fs = require('fs');
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadStore() {
  if (!fs.existsSync(STORE_PATH)) {
    return { settings: {}, users: {} };
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      settings: parsed.settings || {},
      users: parsed.users || {}
    };
  } catch (err) {
    console.error('Could not read data/store.json, starting fresh:', err.message);
    return { settings: {}, users: {} };
  }
}
let writeQueue = Promise.resolve();
function saveStore(store) {
  writeQueue = writeQueue.then(() => new Promise((resolve, reject) => {
    const tmpPath = STORE_PATH + '.tmp';
    fs.writeFile(tmpPath, JSON.stringify(store, null, 2), (err) => {
      if (err) return reject(err);
      fs.rename(tmpPath, STORE_PATH, (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  }));
  return writeQueue;
}
async function getSetting(key, fallback = null) {
  const store = loadStore();
  return Object.prototype.hasOwnProperty.call(store.settings, key) ? store.settings[key] : fallback;
}
async function setSetting(key, value) {
  const store = loadStore();
  store.settings[key] = String(value);
  await saveStore(store);
}
async function getAllSettings() {
  const store = loadStore();
  return { ...store.settings };
}
async function createUser(username, passwordHash, permissions) {
  const store = loadStore();
  store.users[username] = {
    passwordHash,
    permissions,
    createdAt: new Date().toISOString()
  };
  await saveStore(store);
}
async function getUser(username) {
  const store = loadStore();
  const u = store.users[username];
  if (!u) return null;
  return {
    username,
    passwordHash: u.passwordHash,
    permissions: u.permissions,
    createdAt: u.createdAt
  };
}
async function listUsers() {
  const store = loadStore();
  return Object.keys(store.users)
    .map(username => ({
      username,
      permissions: store.users[username].permissions,
      createdAt: store.users[username].createdAt
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
async function deleteUser(username) {
  const store = loadStore();
  delete store.users[username];
  await saveStore(store);
}
module.exports = {
  getSetting,
  setSetting,
  getAllSettings,
  createUser,
  getUser,
  listUsers,
  deleteUser
};
