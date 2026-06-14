const fs = require('fs');
const path = require('path');

const CONV_DIR = path.join(__dirname, 'data', 'conversations');
const MAX_HISTORY = 20;

function ensureDir() {
  if (!fs.existsSync(CONV_DIR)) {
    fs.mkdirSync(CONV_DIR, { recursive: true });
  }
}

function sanitize(str) {
  return (str || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function historyPath(userId, memberName) {
  return path.join(CONV_DIR, `${sanitize(userId)}_${sanitize(memberName)}.json`);
}

function loadHistory(userId, memberName) {
  if (!userId || !memberName) return [];
  ensureDir();
  try {
    const filePath = historyPath(userId, memberName);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || [];
  } catch {
    return [];
  }
}

function saveHistory(userId, memberName, messages) {
  if (!userId || !memberName) return;
  ensureDir();
  const trimmed = (messages || []).slice(-MAX_HISTORY);
  fs.writeFileSync(historyPath(userId, memberName), JSON.stringify(trimmed, null, 2), 'utf8');
}

function addMessage(userId, memberName, role, content) {
  const history = loadHistory(userId, memberName);
  history.push({ role, content, timestamp: new Date().toISOString() });
  const trimmed = history.slice(-MAX_HISTORY);
  saveHistory(userId, memberName, trimmed);
  return trimmed;
}

function clearHistory(userId, memberName) {
  if (!userId || !memberName) return;
  const filePath = historyPath(userId, memberName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = { loadHistory, saveHistory, addMessage, clearHistory, MAX_HISTORY, CONV_DIR };
