const fs = require('fs');
const path = require('path');

const CONV_DIR = path.join(__dirname, 'data', 'conversations');
const META_PATH = path.join(CONV_DIR, '_meta.json');
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

// ── 最後の担当者メタデータ ──────────────────────────

function loadMeta() {
  ensureDir();
  try {
    if (!fs.existsSync(META_PATH)) return {};
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8')) || {};
  } catch {
    return {};
  }
}

function saveMeta(meta) {
  ensureDir();
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf8');
}

function getLastAssignee(userId) {
  if (!userId) return null;
  return loadMeta()[userId] || null;
}

function setLastAssignee(userId, memberName) {
  if (!userId || !memberName) return;
  const meta = loadMeta();
  meta[userId] = memberName;
  saveMeta(meta);
}

function clearLastAssignee(userId) {
  if (!userId) return;
  const meta = loadMeta();
  delete meta[userId];
  saveMeta(meta);
}

// ── タスクストレージ（DB化準備：将来SQLite/Supabaseへ差し替え可能） ──

const TASKS_DIR = path.join(__dirname, 'data', 'tasks');
const TASKS_FILE = path.join(TASKS_DIR, 'tasks.json');

function ensureTasksDir() {
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
}

function loadAllTasks() {
  ensureTasksDir();
  try {
    if (!fs.existsSync(TASKS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) || [];
  } catch { return []; }
}

function writeAllTasks(tasks) {
  ensureTasksDir();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function saveTask(task) {
  if (!task || !task.taskId) return;
  const tasks = loadAllTasks();
  const idx = tasks.findIndex(t => t.taskId === task.taskId);
  if (idx >= 0) tasks[idx] = { ...tasks[idx], ...task, updatedAt: new Date().toISOString() };
  else tasks.unshift({ ...task, createdAt: task.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  writeAllTasks(tasks);
}

function getTasks(userId) {
  const tasks = loadAllTasks();
  return userId ? tasks.filter(t => !t.userId || t.userId === userId) : tasks;
}

function updateTaskStatus(taskId, status) {
  if (!taskId || !status) return false;
  const tasks = loadAllTasks();
  const task = tasks.find(t => t.taskId === taskId);
  if (!task) return false;
  task.status = status;
  task.updatedAt = new Date().toISOString();
  writeAllTasks(tasks);
  return true;
}

module.exports = {
  loadHistory,
  saveHistory,
  addMessage,
  clearHistory,
  getLastAssignee,
  setLastAssignee,
  clearLastAssignee,
  MAX_HISTORY,
  CONV_DIR,
  // タスクストレージ
  saveTask,
  getTasks,
  updateTaskStatus,
};
