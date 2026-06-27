const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'custom-members.json');

function readAll() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    console.warn('[customMembersDb] 読み込みエラー:', e.message);
    return [];
  }
}

function writeAll(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

function getAll() {
  return readAll();
}

function getById(id) {
  return readAll().find(m => m.id === id) || null;
}

function save(member) {
  const { id, name, emoji, description, agentRole } = member;
  if (!id || !name) throw new Error('id と name は必須です');
  const list = readAll();
  const idx  = list.findIndex(m => m.id === id);
  const entry = { id, name, emoji: emoji || '🤖', description: description || '', agentRole: agentRole || 'worker' };
  if (idx >= 0) { list[idx] = entry; } else { list.push(entry); }
  writeAll(list);
  return entry;
}

function remove(id) {
  const list = readAll().filter(m => m.id !== id);
  writeAll(list);
}

module.exports = { getAll, getById, save, remove };
