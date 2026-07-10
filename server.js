const express = require('express');
const dotenv = require('dotenv');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const { costTracker, resetCostTracker } = require('./costTracker');
const { generateReply, strategyMonitor, strategyConsolidate, leaderSummary, LINE_AGENT_PROFILES, buildCompanyContext, buildStrategyCompanyContext, AGENT_WORKFLOW_CONFIG, callOpenAI, runAutoTaskWorkflow, runCompanyBrain, ORGANIZATION_MAP } = require('./openaiClient');
const { loadHistory, addMessage, getLastAssignee, setLastAssignee } = require('./conversationHistory');
const { CLAUDE_AGENTS, callClaudeAI, CLAUDE_MODEL_MAP, generateClaudeReply, claudeUsage, testClaudeAgent, getClaudeModelForRole, CLAUDE_MODEL_POLICY, CLAUDE_MODEL_POLICY_VERSION } = require('./claudeClient'); // Phase47-2B
const { getSummary: getClaudeCostSummary, getClaudeCostAnalysis, buildClaudeModelQualityCompare, buildClaudeModelAdoptionStatus, buildClaudeQualityMonitor, recordClaudeQualityHistory, getClaudeQualityHistory, buildClaudeQualityTrend, buildClaudeQualityWarning } = require('./claudeCostTracker'); // Phase47-1.6 / Phase47-2A / Phase47-2C / Phase47-2D / Phase47-3 / Phase47-4

// Phase37: Workflow 内 agentCaller — Claude担当は Claude API、それ以外は OpenAI
// 循環依存回避のため server.js で定義（openaiClient ↔ claudeClient の直接 import を防ぐ）
async function workflowAgentCaller(agentId, systemPrompt, message, history = []) {
  if (CLAUDE_AGENTS.has(agentId)) {
    const startMs = Date.now();
    const text = await callClaudeAI(systemPrompt, message, history, agentId);
    if (text !== null) {
      return {
        text,
        provider:  'claude',
        model:     getClaudeModelForRole(agentId),
        fallback:  false,
        responseMs: Date.now() - startMs,
      };
    }
    // Claude 失敗 → OpenAI Fallback
    console.warn(`[Phase37 Fallback] ${agentId}: Claude失敗 → OpenAI切り替え`);
    const fallbackText = await callOpenAI(systemPrompt, message, history);
    return {
      text:      fallbackText || '',
      provider:  'openai_fallback',
      model:     null,
      fallback:  true,
      responseMs: Date.now() - startMs,
    };
  }
  // OpenAI担当（Leader / SNS / Video など）
  const startMs = Date.now();
  const text = await callOpenAI(systemPrompt, message, history);
  return {
    text:      text || '',
    provider:  'openai',
    model:     null,
    fallback:  false,
    responseMs: Date.now() - startMs,
  };
}

dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3000;
const channelSecret = process.env.LINE_CHANNEL_SECRET;
const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const adminUserId = process.env.ADMIN_LINE_USER_ID || '';
const conversationStates = new Map();

// LINE返信用: AIのJSON返答からreplyだけ取り出し、suggestionsを番号付き文章化
// agentId を渡すと先頭に担当名を付ける
function extractReplyForLINE(rawText, agentId = '') {
  const agentName = agentId && LINE_AGENT_PROFILES[agentId]
    ? LINE_AGENT_PROFILES[agentId].name
    : '';
  const prefix = agentName ? agentName + '\n' : '';
  if (!rawText) return prefix || '';
  try {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(rawText.slice(start, end + 1));
      if (typeof parsed.reply === 'string') {
        let result = prefix + parsed.reply;
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
          result += '\n\n選べる候補：\n' + parsed.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
        }
        return result;
      }
    }
  } catch {}
  return prefix + rawText;
}

const ASSIGNMENT_RULES = [
  { assignee: 'estimate', keywords: ['見積', '面積', '屋根', '外壁'] },
  { assignee: 'sns', keywords: ['sns', '投稿', 'tiktok', 'インスタ'] },
  { assignee: 'video', keywords: ['動画', '台本', 'ショート'] },
  { assignee: 'writer', keywords: ['文章', 'ブログ', '挨拶文', 'メール'] },
  { assignee: 'designer', keywords: ['デザイン', 'チラシ', '画像'] },
];

const CONTINUATION_WORDS = ['続き', 'それで', 'さらに', '問い合わせ', 'もっと', '次は'];

function isContinuationMessage(text) {
  return CONTINUATION_WORDS.some((w) => text.includes(w));
}

function determineAssignee(messageText = '') {
  const normalizedText = (messageText || '').toLowerCase();

  const matchedRule = ASSIGNMENT_RULES.find(({ keywords }) =>
    keywords.some((keyword) => normalizedText.includes(keyword.toLowerCase()))
  );

  return matchedRule ? matchedRule.assignee : 'leader';
}

async function createReplyText(messageText = '', assignee = '', userId = '') {
  const normalizedText = (messageText || assignee || '').toString().trim().toLowerCase();

  // ── LINEコントロールコマンド（固定応答） ──────────────────
  if (/(料金|コスト)/.test(normalizedText)) return costTracker.getMeterText();
  if (normalizedText.includes('停止')) { costTracker.stopProcessing(); return '🛑 APIを停止しました。'; }
  if (normalizedText.includes('再開')) { costTracker.resumeProcessing(); return '✅ APIを再開しました。'; }
  if (/^上限変更\s*(\d+)$/.test(normalizedText)) {
    const limit = Number(normalizedText.match(/^上限変更\s*(\d+)$/)[1]);
    costTracker.setMonthlyLimit(limit);
    return `✅ 月額上限を${limit}円に変更しました。`;
  }
  if (normalizedText.includes('状態')) return costTracker.getStatusText();
  if (normalizedText.includes('テスト')) return '🎯 縁美創AI COMPANY\nLINE接続テストOKです。';
  if (costTracker.getSummary().stopped) return costTracker.getStopText();
  // ──────────────────────────────────────────────────────────

  // 全ての相談をAIへ（ハードコードなし・キーワードマッチ廃止）
  const memberName = assignee || 'leader';
  const history = loadHistory(userId, memberName, 'line');
  if (userId) addMessage(userId, memberName, 'user', messageText, 'line');
  const openAiReply = await generateReply({ messageText, assignee: memberName, history });
  const rawText = openAiReply.text || JSON.stringify({ reply: '内容を受け付けました。担当へ振り分けます。', suggestions: [] });
  const replyText = extractReplyForLINE(rawText, memberName);
  if (openAiReply.text && userId) {
    addMessage(userId, memberName, 'assistant', replyText, 'line');
    setLastAssignee(userId, memberName);
  }
  return replyText;
}

const AGENT_PROFILES = {
  leader: {
    name: '👑 マネージャー',
    role: 'leader',
  },
  designer: {
    name: 'デザイナー',
    role: 'designer',
  },
  marketing: {
    name: 'マーケティング',
    role: 'marketing',
  },
  writer: {
    name: 'ライター',
    role: 'writer',
  },
  estimate: {
    name: '見積担当',
    role: 'estimate',
  },
};

function createAgentReply(agentKey = 'leader', bodyText, options = []) {
  const profile = AGENT_PROFILES[agentKey] || AGENT_PROFILES.leader;
  const normalizedBodyText = (bodyText || '').toString();
  const isLeaderReply = agentKey === 'leader';
  const introText = isLeaderReply
    ? normalizedBodyText
    : (normalizedBodyText.startsWith('【') ? normalizedBodyText : `【${profile.name}】\n${normalizedBodyText}`);
  const lines = [
    introText,
    isLeaderReply ? '要件を確認し、最適な担当へ振り分けます。' : '内容を確認したら、適切な部署へ振り分けます。',
    '必要な場合だけ追加で質問します。',
    '4択になければ、そのまま文字で返信してください。',
  ].filter(Boolean);

  return {
    type: 'text',
    text: lines.join('\n'),
    quickReply: {
      items: options.map(({ label, text: optionText }) => ({
        type: 'action',
        action: {
          type: 'message',
          label,
          text: optionText,
        },
      })),
    },
  };
}

function createQuickReplyPayload(text, options = []) {
  return createAgentReply('leader', text, options);
}

function getConversationState(userId) {
  if (!userId) {
    return null;
  }

  if (!conversationStates.has(userId)) {
    conversationStates.set(userId, { specialists: {} });
  }

  return conversationStates.get(userId);
}

function getOrCreateSpecialistState(userId, agentKey) {
  const state = getConversationState(userId);

  if (!state) {
    return null;
  }

  if (!state.specialists[agentKey]) {
    state.specialists[agentKey] = { stage: 0, answers: [] };
  }

  return state.specialists[agentKey];
}

function createSpecialistReplyPayloads(messageText = '', userId = '') {
  const normalizedText = (messageText || '').trim().toLowerCase();

  if (!/(チラシ|改善|目的)/.test(normalizedText)) {
    return [];
  }

  const discussionPayloads = [
    {
      agentKey: 'designer',
      bodyText: '【デザイナー】\nチラシ改善の第一歩として、配色とレイアウトの方向性を整理したいです。高級感と親しみやすさのどちらを優先したいですか？',
    },
    {
      agentKey: 'marketing',
      bodyText: '【マーケティング】\nデザイナーの意見を踏まえると、反響につながる導線に寄せるのが自然です。問い合わせ増加を狙うなら、訴求の明確さを優先したいです。',
    },
    {
      agentKey: 'writer',
      bodyText: '【ライター】\nデザインの印象と集客の狙いを踏まえると、コピーは安心感と行動喚起の両方を入れるのが良さそうです。前の担当の意見を受けて、言葉のトーンを少しだけ強めたいです。',
    },
    {
      agentKey: 'estimate',
      bodyText: '【見積担当】\n先ほどの意見を踏まえると、利益を守りつつ成約率を上げるために、単価の見せ方と見積の入り口を整えるのが効果的です。',
    },
    {
      agentKey: 'leader',
      bodyText: '【担当振り分け】\n全員の意見を整理すると、最終提案は「高級感を保ちつつ、問い合わせにつながる導線と安心感あるコピーで訴求する」案に1つにまとめられます。',
    },
  ];

  return discussionPayloads.map(({ agentKey, bodyText }) => ({
    ...createAgentReply(agentKey, bodyText, []),
    agentKey,
  }));
}

function createSpecialistFollowUpPayloads(messageText = '', userId = '') {
  const normalizedText = (messageText || '').trim();
  const specialistKeys = ['designer', 'marketing', 'writer', 'estimate'];

  specialistKeys.forEach((agentKey) => {
    const specialistState = getOrCreateSpecialistState(userId, agentKey);

    if (specialistState) {
      specialistState.stage = specialistState.stage + 1;
      specialistState.answers.push(normalizedText);
    }
  });

  const discussionPayloads = [
    {
      agentKey: 'designer',
      bodyText: `【デザイナー】\n前回のご要望を踏まえると、配色とレイアウトの方向性をさらに具体化したいです。高級感と親しみやすさのどちらを優先するか、最初の判断軸にしたいです。`,
    },
    {
      agentKey: 'marketing',
      bodyText: `【マーケティング】\nデザイナーの意見を踏まえると、反響につながる導線に寄せた方が自然です。問い合わせ増加を狙うなら、ここは訴求の明確さを最優先したいです。`,
    },
    {
      agentKey: 'writer',
      bodyText: `【ライター】\nデザインの印象と集客の狙いを踏まえると、コピーは安心感と行動喚起の両方を入れるのが良さそうです。前の担当の意見を受けて、言葉のトーンを少しだけ強めたいです。`,
    },
    {
      agentKey: 'estimate',
      bodyText: `【見積担当】\n先ほどの意見を踏まえると、利益を守りつつ成約率を上げるために、単価の見せ方と見積の入り口を整えるのが効果的です。`,
    },
    {
      agentKey: 'leader',
      bodyText: `【担当振り分け】\n全員の意見を整理すると、最終提案は「高級感を保ちつつ、問い合わせにつながる導線と安心感あるコピーで訴求する」案に1つにまとめられます。`,
    },
  ];

  return discussionPayloads.map(({ agentKey, bodyText }) => ({
    ...createAgentReply(agentKey, bodyText, []),
    agentKey,
  }));
}

function resetConversationState(userId) {
  if (!userId) {
    return;
  }

  conversationStates.set(userId, { specialists: {} });
}

async function getReplyPayload(event, configuredAdminUserId = adminUserId, options = {}) {
  const messageText = event?.message?.type === 'text' ? event.message.text || '' : '';
  const normalizedText = (messageText || '').trim().toLowerCase();
  const userId = event?.source?.userId || '';
  const userIdKeywords = [
    'user id',
    'userid',
    'user-id',
    '自分のline user id',
    '自分のuser id',
    '自分のuserid',
    '自分のid',
    'id',
  ];

  if (userId && userIdKeywords.some((keyword) => normalizedText.includes(keyword))) {
    if (configuredAdminUserId && !shouldReplyToEvent(event, configuredAdminUserId)) {
      return null;
    }

    return {
      type: 'text',
      text: `あなたのLINE userIdは次の通りです。\n${userId}`,
    };
  }

  if (!configuredAdminUserId || !shouldReplyToEvent(event, configuredAdminUserId)) {
    return null;
  }

  if (/(チラシ|改善|目的)/.test(normalizedText)) {
    if (options.splitBySpecialist) {
      const specialistState = userId ? getConversationState(userId) : null;
      const hasActiveConversation = Boolean(
        specialistState && Object.values(specialistState.specialists || {}).some((state) => state.stage > 0)
      );

      if (hasActiveConversation) {
        return createSpecialistFollowUpPayloads(messageText, userId);
      }

      return createSpecialistReplyPayloads(messageText, userId);
    }

    return createQuickReplyPayload(
      'チラシ改善ですね。\nまず目的を選んでください。',
      [
        { label: '1. 問い合わせを増やしたい', text: '問い合わせを増やしたい' },
        { label: '2. 見積依頼を増やしたい', text: '見積依頼を増やしたい' },
        { label: '3. LINE登録を増やしたい', text: 'LINE登録を増やしたい' },
        { label: '4. 信頼感を上げたい', text: '信頼感を上げたい' },
      ]
    );
  }

  if (/(課金|有料api|外部契約|本番公開|削除|大量送信|確認)/.test(normalizedText)) {
    return createQuickReplyPayload(
      '課金、有料API追加、外部契約、本番公開、削除、大量送信は必ず確認してください。',
      [
        { label: 'はい、確認済みです', text: 'はい、確認済みです' },
        { label: '追加で確認します', text: '追加で確認します' },
        { label: '保留にします', text: '保留にします' },
        { label: '今は進めません', text: '今は進めません' },
      ]
    );
  }

  const specialistState = userId ? getConversationState(userId) : null;
  const hasActiveConversation = Boolean(
    specialistState && Object.values(specialistState.specialists || {}).some((state) => state.stage > 0)
  );

  if (options.splitBySpecialist && hasActiveConversation && userId) {
    return createSpecialistFollowUpPayloads(messageText, userId);
  }

  // 継続ワードかつ前回担当が存在する場合はそちらを優先
  let assignee = determineAssignee(messageText);
  if (userId && isContinuationMessage(normalizedText)) {
    const lastAssignee = getLastAssignee(userId);
    if (lastAssignee) assignee = lastAssignee;
  }

  const replyText = await createReplyText(messageText, assignee, userId);
  return {
    type: 'text',
    text: replyText,
  };
}

async function getReplyText(event, configuredAdminUserId = adminUserId) {
  const replyPayload = await getReplyPayload(event, configuredAdminUserId);

  return replyPayload?.text || null;
}

function shouldReplyToEvent(event, configuredAdminUserId = adminUserId) {
  if (!configuredAdminUserId) {
    return false;
  }

  return event?.source?.userId === configuredAdminUserId;
}

if (!channelSecret || !accessToken) {
  console.error('LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN must be set in .env.local');
  process.exit(1);
}

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── API料金メーター ───────────────────────────────
app.get('/api/cost', (req, res) => {
  try {
    const summary = costTracker.getSummary();
    res.json({ ok: true, ...summary });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});
// ─────────────────────────────────────────────────

// ── 認証API ──────────────────────────────────────
// WEB_APP_PASSWORD が未設定の場合は認証スキップ（ローカル開発用）
app.get('/api/auth-required', (req, res) => {
  res.json({ required: Boolean(process.env.WEB_APP_PASSWORD) });
});

app.post('/api/login', express.json(), (req, res) => {
  const serverPassword = process.env.WEB_APP_PASSWORD;
  if (!serverPassword) {
    return res.json({ ok: true });
  }
  const { password } = req.body || {};
  if (!password || password !== serverPassword) {
    return res.status(401).json({ ok: false, message: '合言葉が違います' });
  }
  res.json({ ok: true });
});
// ─────────────────────────────────────────────────

// ── Supabase連携ライブラリ（遅延ロード）───────────────
let _membersDb, _tasksDb, _customMembersDb;
function getMembersDb()       { if (!_membersDb)       _membersDb       = require('./lib/membersDb');       return _membersDb; }
function getTasksDb()         { if (!_tasksDb)         _tasksDb         = require('./lib/tasksDb');         return _tasksDb; }
function getCustomMembersDb() { if (!_customMembersDb) _customMembersDb = require('./lib/customMembersDb'); return _customMembersDb; }

// ── personaRegistry: UIカテゴリ構造を動的提供 ──────────────
// LINE_AGENT_PROFILES から buildCategoriesForUI() で生成するため
// 新担当追加時はこのエンドポイントの変更不要
app.get('/api/profiles', (req, res) => {
  try {
    const { buildCategoriesForUI } = require('./openaiClient');
    res.json({ ok: true, categories: buildCategoriesForUI() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── AI社員一覧 API ────────────────────────────────
app.get('/api/members', async (req, res) => {
  try {
    const { members, source } = await getMembersDb().getMembers();
    res.json({ ok: true, members, source });
  } catch (e) {
    const { FALLBACK_MEMBERS } = getMembersDb();
    res.json({ ok: true, members: FALLBACK_MEMBERS, source: 'fallback' });
  }
});

// ── カスタム担当 管理API ─────────────────────────────
app.get('/api/admin/members', (req, res) => {
  try {
    res.json({ ok: true, members: getCustomMembersDb().getAll() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/admin/members', express.json(), (req, res) => {
  try {
    const { id, name, emoji, description, agentRole } = req.body || {};
    if (!id || !name) return res.status(400).json({ ok: false, error: 'id と name は必須です' });
    if (!/^[a-z0-9_-]+$/.test(id)) return res.status(400).json({ ok: false, error: 'id は英小文字・数字・_-のみ使用可能です' });
    const saved = getCustomMembersDb().save({ id, name, emoji, description, agentRole });
    res.json({ ok: true, member: saved });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/admin/members/:id', (req, res) => {
  try {
    getCustomMembersDb().remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── タスク一覧取得 ────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  try {
    const { memberId, status } = req.query;
    const result = await getTasksDb().getTasks({ memberId, status });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.json({ ok: true, tasks: [], source: 'error', error: e.message });
  }
});

// ── タスク作成 ────────────────────────────────────
app.post('/api/tasks', express.json(), async (req, res) => {
  const { title, description, assignedMemberId, createdBy, sourceMessage, priority } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: 'title は必須です' });
  try {
    const result = await getTasksDb().createTask({ title, description, assignedMemberId, createdBy, sourceMessage, priority });
    res.json({ ok: !result.error, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── タスク ステータス更新 ─────────────────────────
app.patch('/api/tasks/:id', express.json(), async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ ok: false, error: 'status は必須です' });
  try {
    const result = await getTasksDb().updateTaskStatus(req.params.id, status);
    if (!result.error) {
      await getTasksDb().addTaskLog({
        taskId: req.params.id,
        action: 'status_change',
        message: `→ ${status}`,
      });
    }
    res.json({ ok: !result.error, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// ─────────────────────────────────────────────────

// ── Web UI チャット API ───────────────────────────
app.post('/api/chat', express.json(), async (req, res) => {
  const { message, memberId, history, knowledgeContext = '' } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, error: 'message は必須です' });
  }
  try {
    const agent = memberId || 'leader';
    const genre = detectGenre(message);

    // Supabaseから学習データ・会社記憶・ノウハウを並行取得
    const [bestsResult, avoidsResult, successResult, failureResult, knowledgeResult, scoreResult, strategyResult] = await Promise.allSettled([
      getLearningDb().getBestPractices(agent, genre),
      getLearningDb().getAvoidPractices(agent, genre),
      getCompanyMemDb().getMemories({ memoryType: 'success', genre, limit: 3 }),
      getCompanyMemDb().getMemories({ memoryType: 'failure', genre, limit: 2 }),
      getKnowledgeDb().getByGenreForPrompt(genre, 3),
      getCompanyScoreDb().getScore(),
      getCompanyScoreDb().getStrategyLearning(),
    ]);
    const bests  = bestsResult.status === 'fulfilled'  ? (bestsResult.value.practices  || []) : [];
    const avoids = avoidsResult.status === 'fulfilled' ? (avoidsResult.value.practices || []) : [];
    const successCases   = successResult.status === 'fulfilled'  ? (successResult.value.data   || []) : [];
    const failureCases   = failureResult.status === 'fulfilled'  ? (failureResult.value.data   || []) : [];
    const knowledgeItems = knowledgeResult.status === 'fulfilled'? (knowledgeResult.value || []) : [];
    const score          = scoreResult.status === 'fulfilled'    ? (scoreResult.value.score     || {}) : {};
    const stratData      = strategyResult.status === 'fulfilled' ? (strategyResult.value.data   || {}) : {};

    // 会社記憶・業種ノウハウを構築
    const companyCtx = buildCompanyContext({ genre, successCases, failureCases, knowledgeItems, isLeader: agent === 'leader' });
    const strategyCtx = agent === 'strategy'
      ? buildStrategyCompanyContext({
          successRate:             score.successRate || 0,
          avgRating:               score.avgRating   || 0,
          totalCases:              score.totalCases  || 0,
          interventionSuccessRate: stratData.interventionSuccessRate || 0,
          topGenres: 'なし',
        })
      : '';

    // カスタム担当の場合はプロフィールデータを渡してautoGenerateProfileを強化
    const customMemberData = getCustomMembersDb().getById(agent);

    // Phase27: Claude対象社員（writer/reviewer/strategy）はClaude APIへ routing
    const replyFn = CLAUDE_AGENTS.has(agent) ? generateClaudeReply : generateReply;
    const result = await replyFn({
      messageText: message,
      assignee: agent,
      history: Array.isArray(history) ? history.slice(-20) : [],
      bestPractices: bests,
      avoidPractices: avoids,
      companyContext: companyCtx,
      strategyContext: strategyCtx,
      memberData: customMemberData || null,
      knowledgeContext: knowledgeContext || '',
    });
    const reply = result.text
      || JSON.stringify({ reply: 'AIに接続できませんでした。OPENAI_API_KEYを確認してください。', suggestions: [] });
    return res.json({ ok: true, reply, fixedSuggestions: result.fixedSuggestions || null });
  } catch (e) {
    console.error('/api/chat error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});
// ─────────────────────────────────────────────────

// ── Strategy 全担当統合意見 API ───────────────────────
// POST /api/strategy-consolidate { userMessage, memberReplies: [{id, name, reply}] }
app.post('/api/strategy-consolidate', express.json(), async (req, res) => {
  const { userMessage, memberReplies } = req.body || {};
  if (!userMessage || !Array.isArray(memberReplies) || memberReplies.length === 0) {
    return res.json({ ok: false, error: 'userMessage と memberReplies は必須です' });
  }
  try {
    const result = await strategyConsolidate({ userMessage, memberReplies });
    if (result) {
      return res.json({ ok: true, reply: result.reply || '', suggestions: result.suggestions || [] });
    }
    return res.json({ ok: false, error: '統合意見を生成できませんでした' });
  } catch (e) {
    console.error('/api/strategy-consolidate error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});
// ─────────────────────────────────────────────────

// ── Leader 推奨方針サマリー API ───────────────────
// POST /api/leader-summary { userMessage, memberReplies, strategyReply }
app.post('/api/leader-summary', express.json(), async (req, res) => {
  const { userMessage, memberReplies, strategyReply } = req.body || {};
  if (!userMessage || !memberReplies) {
    return res.json({ ok: false, error: 'missing params' });
  }
  try {
    const reply = await leaderSummary(userMessage, memberReplies, strategyReply || '');
    if (!reply) return res.json({ ok: false, error: 'no reply' });
    return res.json({ ok: true, reply });
  } catch (e) {
    console.error('/api/leader-summary error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});
// ─────────────────────────────────────────────────

// ── Strategy 常時監視 API ─────────────────────────
// POST /api/strategy-monitor { userMessage, aiReply, memberId }
app.post('/api/strategy-monitor', express.json(), async (req, res) => {
  const { userMessage, aiReply, memberId } = req.body || {};
  if (!userMessage || !aiReply || !memberId) {
    return res.json({ ok: false, intervene: false });
  }
  // Strategy自身の返答は監視しない（無限ループ防止）
  if (memberId === 'strategy') return res.json({ ok: true, intervene: false });
  try {
    const result = await strategyMonitor({ userMessage, aiReply, memberId });
    if (result && result.intervene) {
      return res.json({ ok: true, intervene: true, reply: result.reply || '', suggestions: result.suggestions || [] });
    }
    return res.json({ ok: true, intervene: false });
  } catch (e) {
    console.error('/api/strategy-monitor error:', e.message);
    return res.json({ ok: false, intervene: false });
  }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// タスク自動進行 API（Auto-task workflow）
//
// POST /api/auto-task
//
// リクエスト（Request body）:
//   userMessage : string  ユーザーの元の依頼内容
//   tasks       : array   実行するタスクの一覧
//     各タスクの構造：
//       id          : string   タスクの一意ID
//       agentId     : string   担当ID（例: "writer", "sns"）
//       instruction : string   担当への指示（省略時は userMessage を使用）
//       dependsOn   : string[] 前工程タスクIDの配列（空配列 = 最初に実行）
//
// レスポンス（Response）:
//   ok      : boolean  成功フラグ
//   results : array    各タスクの実行結果（status / result / provider 含む）
//
// 設計方針（Design notes）:
//   ・依存グラフ（dependency graph）に基づき前工程が完了したタスクから順次実行
//   ・前工程の result（実行結果）は次のタスクの文脈として自動付加
//   ・enabled: false の担当はスキップ（将来担当追加時に切り替え可能）
//   ・provider（AIの種類）は現在 "openai" のみ。将来 "claude" 対応を予定
// ══════════════════════════════════════════════════════════════
app.post('/api/auto-task', express.json(), async (req, res) => {
  const { userMessage, tasks, autonomousConsult = false, workflowId = null, knowledgeContext = '' } = req.body || {};

  // 入力バリデーション（input validation）
  if (!userMessage || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'userMessage と tasks（配列）は必須です',
    });
  }

  // タスク数の上限チェック（上限10タスク。無限ループ防止）
  if (tasks.length > 10) {
    return res.status(400).json({
      ok: false,
      error: 'タスクは最大10件までです',
    });
  }

  try {
    // Phase37: agentCaller を渡すことで Claude/OpenAI を動的ルーティング
    // Phase42修正: onProgress で逐次進捗をグローバルストアへ書き込む
    if (!global.__workflowProgress) global.__workflowProgress = {};
    const _wfId = workflowId || ('wf-' + Date.now());
    global.__workflowProgress[_wfId] = { workflowTasks: [], taskHistory: [], brainResult: null, updatedAt: Date.now() };

    const { workflowTasks, taskHistory, brainResult, leaderFinalResult } = await runAutoTaskWorkflow({
      userMessage, tasks, autonomousConsult, workflowId: _wfId, agentCaller: workflowAgentCaller,
      onProgress: (state) => {
        global.__workflowProgress[_wfId] = { ...state, updatedAt: Date.now() };
      },
    });

    // 完了後もストアを最新状態に更新（cleanup は1時間後）
    global.__workflowProgress[_wfId] = { workflowTasks, taskHistory, brainResult, done: true, updatedAt: Date.now() };
    setTimeout(() => { if (global.__workflowProgress) delete global.__workflowProgress[_wfId]; }, 3600000);

    // taskHistory（タスク履歴）をサーバーメモリに蓄積
    // 将来は Supabase の task_history テーブルへ永続化予定
    if (!global.__taskHistory) global.__taskHistory = [];
    global.__taskHistory.push(...taskHistory);

    // Supabase保存：各担当の返答を messages テーブルへ記録
    try {
      const { upsertConversation, saveMessage } = require('./lib/conversationsDb');
      const autoTaskConvId = await upsertConversation({
        userId: 'web-user',
        memberId: 'leader',
        channel: 'web',
      });
      if (autoTaskConvId) {
        await saveMessage({ conversationId: autoTaskConvId, sender: 'user', content: userMessage });
        for (const t of workflowTasks) {
          if (t.result && t.status === 'completed') {
            const agentProfile = LINE_AGENT_PROFILES[t.agentId];
            const agentName = agentProfile ? agentProfile.name : t.agentId;
            await saveMessage({
              conversationId: autoTaskConvId,
              sender: 'assistant',
              content: `【${agentName}】${t.result}`,
            });
          }
        }
      }
    } catch (dbErr) {
      // DB保存エラーは処理を止めない（ログだけ出す）
      console.warn('/api/auto-task Supabase保存エラー:', dbErr.message);
    }

    return res.json({ ok: true, results: workflowTasks, taskHistory, brainResult: brainResult || null, leaderFinalResult: leaderFinalResult || null });
  } catch (e) {
    console.error('/api/auto-task error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});
// ─────────────────────────────────────────────────

// ── Phase42修正: Workflow進捗リアルタイム取得 API ─────────────────────────
// GET /api/workflow-progress?workflowId=xxx
// Auto Task実行中に逐次進捗をポーリングで取得する専用エンドポイント
app.get('/api/workflow-progress', (req, res) => {
  const { workflowId } = req.query;
  if (!workflowId) return res.json({ ok: false, error: 'workflowId is required' });
  if (!global.__workflowProgress || !global.__workflowProgress[workflowId]) {
    return res.json({ ok: true, found: false, workflowTasks: [], taskHistory: [], brainResult: null, done: false });
  }
  const p = global.__workflowProgress[workflowId];
  return res.json({ ok: true, found: true, workflowTasks: p.workflowTasks || [], taskHistory: p.taskHistory || [], brainResult: p.brainResult || null, done: p.done || false, updatedAt: p.updatedAt });
});
// ─────────────────────────────────────────────────

// ── 担当ワークフロー設定取得 API ──────────────────
// GET /api/workflow-config
// フロントエンドから各担当の provider / enabled / collaborators（相談可能担当）を取得する
app.get('/api/workflow-config', (req, res) => {
  res.json({ ok: true, config: AGENT_WORKFLOW_CONFIG });
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// organizationMap（組織図）取得 API
//
// GET /api/org-map
//   全担当の組織図データを返す
//
// GET /api/org-map?agentId=sns
//   指定担当の組織図データのみ返す
//   レスポンス例：
//     {
//       "ok": true,
//       "agentId": "sns",
//       "org": {
//         "parent": "leader",
//         "children": [],
//         "collaborators": ["designer","writer","video","branding"],
//         "reviewer": "reviewer",
//         "finalApprover": "leader"
//       }
//     }
//
// 今回は実処理なし。将来の AI社員間相談・上司確認・最終承認ルーティングで参照する。
// ══════════════════════════════════════════════════════════════
app.get('/api/org-map', (req, res) => {
  const { agentId } = req.query;
  if (agentId) {
    const org = ORGANIZATION_MAP[agentId];
    if (!org) return res.status(404).json({ ok: false, error: `agentId "${agentId}" は組織図に存在しません` });
    return res.json({ ok: true, agentId, org });
  }
  res.json({ ok: true, map: ORGANIZATION_MAP });
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// タスク履歴取得 API（Task history）
//
// GET /api/task-history
//   全タスク履歴（taskHistory）を返す
//
// GET /api/task-history?from=sns
//   from（依頼元）が "sns" の履歴のみ返す
//
// GET /api/task-history?to=writer
//   to（依頼先）が "writer" の履歴のみ返す
//
// 将来：Supabase の task_history テーブルへ永続化した時点で
//   このエンドポイントを DB 読み取りに切り替える
// ══════════════════════════════════════════════════════════════
app.get('/api/task-history', (req, res) => {
  const { from, to } = req.query;
  let history = global.__taskHistory || [];
  if (from) history = history.filter(h => h.from === from);
  if (to)   history = history.filter(h => h.to   === to);
  res.json({ ok: true, history, total: history.length });
});

// ──────────────────────────────────────────────────────────────
// GET /api/workflow-dashboard
// taskHistory を workflowId 単位でグループ化して案件一覧を返す
// ──────────────────────────────────────────────────────────────
app.get('/api/workflow-dashboard', (req, res) => {
  const history = global.__taskHistory || [];

  // workflowId ごとにエントリを集約
  const map = new Map();
  for (const h of history) {
    const wid = h.workflowId || '(未分類)';
    if (!map.has(wid)) {
      map.set(wid, {
        workflowId:   wid,
        userMessage:  h.instruction || '',
        createdAt:    h.requestedAt || null,
        updatedAt:    h.requestedAt || null,
        entries:      [],
      });
    }
    const wf = map.get(wid);
    wf.entries.push(h);
    // 最新の更新日時を追跡
    const ts = h.completedAt || h.requestedAt;
    if (ts && ts > (wf.updatedAt || '')) wf.updatedAt = ts;
    // userMessage は最初の instruction を優先
    if (!wf.userMessage && h.instruction) wf.userMessage = h.instruction;
  }

  // 集計フィールドを付加
  const workflows = [...map.values()].map(wf => {
    const es = wf.entries;
    return {
      ...wf,
      taskCount:     es.filter(e => e.action === '' || e.action == null).length,
      completedCount:es.filter(e => e.status === 'completed').length,
      consultCount:  es.filter(e => e.action === 'auto_consult' || e.action === 'consult').length,
      hasReviewer:   es.some(e => e.action === 'reviewer'),
      hasStrategy:   es.some(e => e.action === 'strategy'),
      hasLeader:     es.some(e => e.action === 'leader_final' || (e.from === 'leader' && e.action === '')),
    };
  // 新しい案件が先
  }).sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);

  res.json({ ok: true, workflows, total: workflows.length });
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// AI社員間相談 API（Agent consultation）
//
// POST /api/consult
//
// リクエスト（Request body）:
//   fromAgentId  : string  相談元の担当ID（例: "sns"）
//   toAgentId    : string  相談先の担当ID（例: "designer"）
//   question     : string  相談内容（ユーザーの元依頼 or 担当からの質問）
//   priorResult  : string  相談元の成果（context として渡す）
//
// 処理の流れ（consultation flow）:
//   1. toAgentId の担当に question + priorResult を渡して AI 回答を生成
//   2. taskHistory（タスク履歴）に from/to/status を記録
//   3. Supabase の messages テーブルに相談結果を保存
//
// レスポンス（Response）:
//   ok          : boolean
//   reply       : string  相談先担当の回答テキスト
//   historyEntry: object  今回記録した taskHistory エントリ
// ══════════════════════════════════════════════════════════════
app.post('/api/consult', express.json(), async (req, res) => {
  const { fromAgentId, toAgentId, question, priorResult, workflowId, knowledgeContext = '' } = req.body || {};

  // 入力バリデーション（input validation）
  if (!fromAgentId || !toAgentId || !question) {
    return res.status(400).json({
      ok: false,
      error: 'fromAgentId / toAgentId / question は必須です',
    });
  }

  // 自己相談禁止（無限ループ防止）
  if (fromAgentId === toAgentId) {
    return res.status(400).json({ ok: false, error: '同じ担当への相談はできません' });
  }

  // 相談先担当が存在するか確認
  const toProfile = LINE_AGENT_PROFILES[toAgentId];
  if (!toProfile) {
    return res.status(400).json({ ok: false, error: `担当 "${toAgentId}" は存在しません` });
  }

  const fromProfile = LINE_AGENT_PROFILES[fromAgentId];
  const fromName = fromProfile ? fromProfile.name : fromAgentId;
  const requestedAt = new Date().toISOString();

  // taskHistory（タスク履歴）エントリを作成（実行前に記録開始）
  if (!global.__taskHistory) global.__taskHistory = [];
  const histEntry = {
    historyId: `consult-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action: 'consult',     // Consult Version1: action識別子
    from: fromAgentId,
    to: toAgentId,
    workflowId: workflowId || null,  // 同一案件の相談履歴として管理するためのID
    taskId: null,          // 相談タスクには固定IDなし
    instruction: question,
    status: 'running',
    requestedAt,
    completedAt: null,
    note: `${fromName} からの相談`,
    type: 'consultation',  // 通常タスクと区別するためのtype（種別）
  };
  global.__taskHistory.push(histEntry);

  try {
    // 相談先担当のシステムプロンプト（system prompt）を使って AI 回答を生成
    // priorResult（相談元の成果）を文脈として付加する
    const { buildSystemPrompt } = require('./openaiClient');
    const { callOpenAI } = (() => {
      // openaiClient 内部の callOpenAI を間接取得（generateReply 経由）
      return { callOpenAI: null };
    })();

    // generateReply を使って相談先担当の視点で回答を生成
    const consultInstruction = priorResult
      ? `【${fromName}からの相談】\n${question}\n\n【${fromName}の成果（参考）】\n${priorResult}`
      : `【${fromName}からの相談】\n${question}`;

    // Phase27: Claude対象社員への相談もClaude APIへ routing
    const consultFn = CLAUDE_AGENTS.has(toAgentId) ? generateClaudeReply : generateReply;
    const result = await consultFn({
      messageText: consultInstruction,
      assignee: toAgentId,
      history: [],
      knowledgeContext: knowledgeContext || '',
    });

    // AI 返答の JSON から reply 部分を取り出す
    let replyText = result.text || '';
    try {
      const start = replyText.indexOf('{');
      const end   = replyText.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(replyText.slice(start, end + 1));
        if (parsed.reply) replyText = parsed.reply;
      }
    } catch (_) {}

    const completedAt = new Date().toISOString();

    // taskHistory（タスク履歴）を完了に更新
    histEntry.status      = 'completed';
    histEntry.completedAt = completedAt;

    // Supabase に相談結果を保存
    try {
      const { upsertConversation, saveMessage } = require('./lib/conversationsDb');
      const convId = await upsertConversation({
        userId: 'web-user',
        memberId: toAgentId,
        channel: 'web',
      });
      if (convId) {
        await saveMessage({ conversationId: convId, sender: 'user',      content: consultInstruction });
        await saveMessage({ conversationId: convId, sender: 'assistant', content: replyText });
      }
    } catch (dbErr) {
      console.warn('/api/consult Supabase保存エラー:', dbErr.message);
    }

    return res.json({ ok: true, reply: replyText, historyEntry: histEntry });

  } catch (e) {
    // エラー時も taskHistory を更新
    histEntry.status      = 'error';
    histEntry.completedAt = new Date().toISOString();
    histEntry.note        = e.message;
    console.error('/api/consult error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});
// ─────────────────────────────────────────────────

// ── LINE会話履歴取得 API ──────────────────────────
// GET /api/line-history?memberId=sns[&userId=Uxxxxx]
// userId を省略すると ADMIN_LINE_USER_ID を使用
app.get('/api/line-history', (req, res) => {
  const { memberId } = req.query;
  const userId = (req.query.userId || adminUserId || '').trim();

  if (!userId) {
    return res.json({ ok: false, error: 'userId が未設定です（ADMIN_LINE_USER_IDを確認）', messages: [] });
  }
  if (!memberId) {
    return res.status(400).json({ ok: false, error: 'memberId は必須です', messages: [] });
  }

  const raw = loadHistory(userId, memberId, 'line');
  const messages = raw.map(m => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp || null,
    channel: 'line',
    userId,
    memberId,
  }));
  res.json({ ok: true, messages, count: messages.length, userId, memberId });
});

// LINE履歴が存在するメンバー一覧
// GET /api/line-history/members[?userId=Uxxxxx]
app.get('/api/line-history/members', (req, res) => {
  const userId = (req.query.userId || adminUserId || '').trim();
  if (!userId) return res.json({ ok: true, members: [] });

  const { CONV_DIR } = require('./conversationHistory');
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = `${safeId}_line_`;
  let members = [];
  try {
    if (require('fs').existsSync(CONV_DIR)) {
      members = require('fs').readdirSync(CONV_DIR)
        .filter(f => f.startsWith(prefix) && f.endsWith('.json') && !f.startsWith('_'))
        .map(f => f.slice(prefix.length, -5));
    }
  } catch (e) {
    console.warn('[line-history/members] scan error:', e.message);
  }
  res.json({ ok: true, members, userId });
});
// ── Web チャット履歴 Supabase保存 ─────────────────
// POST /api/messages  { userId, memberId, sender, content, channel, caseId }
app.post('/api/messages', express.json(), async (req, res) => {
  const { userId = 'web-user', memberId, sender, content, channel = 'web', caseId = null } = req.body || {};
  if (!memberId || !sender || !content) {
    return res.status(400).json({ ok: false, error: 'memberId / sender / content は必須です' });
  }
  try {
    const { upsertConversation, saveMessage } = require('./lib/conversationsDb');
    const convId = await upsertConversation({ userId, memberId, channel });
    if (convId) await saveMessage({ conversationId: convId, sender, content, caseId: caseId || null });   // Phase52-12.2: 案件別分離用にcase_idを保存（未指定はNULL）
    res.json({ ok: true, saved: Boolean(convId) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// Supabase lib モジュール（遅延ロード）
// ══════════════════════════════════════════════════════════════
let _casesDb, _customersDb, _memberScoresDb, _learningDb, _companyMemoryDb, _knowledgeDb, _companyScoreDb, _approvalsDb;
const getCasesDb        = () => _casesDb        || (_casesDb        = require('./lib/casesDb'));
const getCustomersDb    = () => _customersDb    || (_customersDb    = require('./lib/customersDb'));
const getMemberScoresDb = () => _memberScoresDb || (_memberScoresDb = require('./lib/memberScoresDb'));
const getLearningDb     = () => _learningDb     || (_learningDb     = require('./lib/learningDb'));
const getCompanyMemDb   = () => _companyMemoryDb|| (_companyMemoryDb= require('./lib/companyMemoryDb'));
const getKnowledgeDb    = () => _knowledgeDb    || (_knowledgeDb    = require('./lib/knowledgeDb'));
const getCompanyScoreDb = () => _companyScoreDb || (_companyScoreDb = require('./lib/companyScoreDb'));
const getApprovalsDb    = () => _approvalsDb    || (_approvalsDb    = require('./lib/approvalsDb'));

// ジャンル自動判定（/api/chat でも使用）
function detectGenre(text) {
  const t = (text || '').toLowerCase();
  if (/tiktok|ティック|sns|インスタ|youtube|投稿|フォロワー/.test(t)) return 'sns';
  if (/動画|ショート|リール|台本|冒頭/.test(t)) return 'video';
  if (/チラシ|デザイン|画像|構図|配色/.test(t)) return 'design';
  if (/ライティング|文章|コピー|lp|ランディング/.test(t)) return 'writing';
  if (/営業|クロージング|dm|メール|台本/.test(t)) return 'sales';
  if (/分析|roi|利益率|数値|試算/.test(t)) return 'analysis';
  if (/ブランド|コンセプト|世界観|キャッチ/.test(t)) return 'branding';
  if (/市場|競合|調査|リサーチ/.test(t)) return 'research';
  if (/顧客|クレーム|返信|cs|サポート/.test(t)) return 'cs';
  if (/スケジュール|タスク|議事録|予定/.test(t)) return 'secretary';
  return 'general';
}

// strategyLearning は Supabase へ永続化（getCompanyScoreDb().getStrategyLearning() / recordStrategyIntervention()）

// ══════════════════════════════════════════════════════════════
// 案件 API（Supabase永続化）
// ══════════════════════════════════════════════════════════════
// GET /api/cases?memberId=
app.get('/api/cases', async (req, res) => {
  const { memberId } = req.query;
  try {
    const result = await getCasesDb().getCases({ memberId });
    res.json({ ok: true, cases: result.cases, source: result.source });
  } catch (e) { res.json({ ok: false, cases: [], error: e.message }); }
});

// POST /api/cases  { id, title, userText, genre, memberIds }
app.post('/api/cases', express.json(), async (req, res) => {
  const { id, title, userText, genre, memberIds } = req.body || {};
  if (!id || !title) return res.status(400).json({ ok: false, error: 'id / title は必須です' });
  try {
    const result = await getCasesDb().upsertCase({ id, title, userText, genre, memberIds });
    res.json({ ok: !result.error, error: result.error });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// GET /api/case-memory/:caseId
app.get('/api/case-memory/:caseId', async (req, res) => {
  try {
    const result = await getCasesDb().getCases({});
    const found = result.cases.find(c => c.id === req.params.caseId);
    res.json({ ok: true, data: found || null });
  } catch (e) { res.json({ ok: true, data: null }); }
});

// POST /api/case-memory/:caseId  { purpose?, members?, proposal?, result? }
app.post('/api/case-memory/:caseId', express.json(), async (req, res) => {
  const { purpose, members, proposal, result } = req.body || {};
  try {
    const dbResult = await getCasesDb().updateCasePurpose(req.params.caseId, { purpose, proposal, result });
    res.json({ ok: !dbResult.error, error: dbResult.error });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// DELETE /api/cases/:id  （Phase52-12.1: 案件削除同期。id完全一致1件のみcases行を削除。messages/conversationsは削除しない）
app.delete('/api/cases/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ ok: false, error: 'id は必須です' });
  try {
    const result = await getCasesDb().deleteCase(id);
    res.json({ ok: !result.error, error: result.error });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// Approval Sync API（Phase54-1b: 承認/公開状態のSupabase永続化・A案case_idスコープ）
// ══════════════════════════════════════════════════════════════
// GET /api/approvals            → 全件
// GET /api/approvals?caseId=xxx → 1件
// GET /api/approvals?caseId=xxx&outputId=out_xxx → Phase54-1f: case_id + output_id 一致の1件（outputIdは任意）
app.get('/api/approvals', async (req, res) => {
  const { caseId, outputId } = req.query;   // Phase54-1f: outputId は任意（未指定時は従来動作）
  try {
    if (caseId) {
      const result = await getApprovalsDb().getApproval(caseId, outputId);
      return res.json({ ok: true, approval: result.approval, source: result.source });
    }
    const result = await getApprovalsDb().getApprovals();
    res.json({ ok: true, approvals: result.approvals, source: result.source });
  } catch (e) { res.json({ ok: false, approvals: [], error: e.message }); }
});

// POST /api/approvals { caseId, outputId?, approvalDecision, approvedAt, published, publishedAt, archived, checklist, reviewStatus }
// ※ server.js は app.use(express.json()) をグローバル設定済みのため、per-route express.json() は付けない
// ※ Phase54-1f: outputId は任意（未指定の旧クライアントは従来どおり動作し、既存 output_id を保持する）
app.post('/api/approvals', async (req, res) => {
  const { caseId, outputId, approvalDecision, approvedAt, published, publishedAt, archived, checklist, reviewStatus } = req.body || {};
  if (!caseId) return res.status(400).json({ ok: false, error: 'caseId は必須です' });
  try {
    const result = await getApprovalsDb().upsertApproval({ caseId, outputId, approvalDecision, approvedAt, published, publishedAt, archived, checklist, reviewStatus });
    res.json({ ok: !result.error, error: result.error });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 会社記憶 API（Supabase永続化）
// ══════════════════════════════════════════════════════════════
// GET /api/company-memory?type=success|failure|...
app.get('/api/company-memory', async (req, res) => {
  const { type } = req.query;
  try {
    if (type) {
      const result = await getCompanyMemDb().getMemories({ memoryType: type });
      return res.json({ ok: true, data: result.data });
    }
    const stats = await getCompanyMemDb().getStats();
    res.json({ ok: true, stats: stats.stats, data: {} });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// POST /api/company-memory/improvement { area, before, after }
app.post('/api/company-memory/improvement', express.json(), async (req, res) => {
  const { area, before, after } = req.body || {};
  if (!after) return res.status(400).json({ ok: false, error: 'after は必須です' });
  try {
    await getCompanyMemDb().saveMemory({ memoryType: 'improvement', genre: area || '一般', beforeText: before, afterText: after });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// KNOWLEDGE_LIBRARY API（Supabase永続化）
// ══════════════════════════════════════════════════════════════
// GET /api/knowledge-library?genre=
app.get('/api/knowledge-library', async (req, res) => {
  const { genre } = req.query;
  try {
    if (genre) {
      const result = await getKnowledgeDb().getLibrary(genre);
      return res.json({ ok: true, genre, entries: result.entries });
    }
    const result = await getKnowledgeDb().getAllByGenre();
    res.json({ ok: true, genres: getKnowledgeDb().GENRES, library: result.library });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// POST /api/knowledge-library { genre, title, content, source? }
app.post('/api/knowledge-library', express.json(), async (req, res) => {
  const { genre, title, content, source } = req.body || {};
  if (!genre || !title || !content) {
    return res.status(400).json({ ok: false, error: 'genre / title / content は必須です' });
  }
  try {
    const result = await getKnowledgeDb().addEntry({ genre, title, content, source });
    res.json({ ok: !result.error, error: result.error });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// DELETE /api/knowledge-library/:genre/:id
app.delete('/api/knowledge-library/:genre/:id', async (req, res) => {
  try {
    await getKnowledgeDb().deleteEntry(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 顧客 API（Supabase永続化）
// ══════════════════════════════════════════════════════════════
// GET /api/customers
app.get('/api/customers', async (req, res) => {
  try {
    const result = await getCustomersDb().getCustomers();
    res.json({ ok: true, customers: result.customers });
  } catch (e) { res.json({ ok: false, customers: [], error: e.message }); }
});

// GET /api/customers/:id
app.get('/api/customers/:id', async (req, res) => {
  try {
    const result = await getCustomersDb().getCustomerById(req.params.id);
    if (!result.customer) return res.status(404).json({ ok: false, error: '顧客が見つかりません' });
    res.json({ ok: true, customer: result.customer });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/customers { name, industry, problems?, notes? }
app.post('/api/customers', express.json(), async (req, res) => {
  const { name, industry, problems, notes } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name は必須です' });
  try {
    const result = await getCustomersDb().createCustomer({ name, industry, problems, notes });
    res.json({ ok: !result.error, customer: result.customer, error: result.error });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/customers/:id
app.patch('/api/customers/:id', express.json(), async (req, res) => {
  const { name, industry, problems, contractStatus, notes, proposal } = req.body || {};
  try {
    await getCustomersDb().updateCustomer(req.params.id, { name, industry, problems, contractStatus, notes });
    if (proposal) await getCustomersDb().addProposal(req.params.id, proposal);
    const result = await getCustomersDb().getCustomerById(req.params.id);
    res.json({ ok: true, customer: result.customer });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', async (req, res) => {
  try {
    await getCustomersDb().deleteCustomer(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 知識統計 API（管理画面用）
// ══════════════════════════════════════════════════════════════
// GET /api/claude-status — Phase27: Claude API利用状況
app.get('/api/claude-status', (req, res) => {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  res.json({
    ok: true,
    configured: hasKey,
    status: claudeUsage.status,
    targetAgents: ['writer', 'reviewer', 'strategy'],
    today: {
      requests:     claudeUsage.today.requests,
      inputTokens:  claudeUsage.today.inputTokens,
      outputTokens: claudeUsage.today.outputTokens,
      costUsd:      Math.round(claudeUsage.today.costUsd * 10000) / 10000,
    },
    month: {
      requests:     claudeUsage.month.requests,
      inputTokens:  claudeUsage.month.inputTokens,
      outputTokens: claudeUsage.month.outputTokens,
      costUsd:      Math.round(claudeUsage.month.costUsd * 10000) / 10000,
    },
    lastRequest: claudeUsage.lastRequest,
    lastAgent:   claudeUsage.lastAgent,
    lastModel:   claudeUsage.lastModel,
    errorMsg:    claudeUsage.errorMsg,
  });
});
// ─────────────────────────────────────────────────

// GET /api/claude-cost — Phase47-1.6: Claude API料金永続データ（Phase47-2A: analysis / Phase47-2B: modelPolicy / Phase47-2C: qualityCompare / Phase47-2D: adoptionStatus / Phase47-3: qualityMonitor / Phase47-4: qualityHistory・qualityTrend・qualityWarning追加）
// Phase47-3: Compare Intelligenceのスコアはブラウザ側にのみ存在するため、任意のqueryパラメータ経由で受け取る（未指定時はデータ不足として扱う）
// Phase47-4: 実スコア受信時のみ、時系列履歴（メモリ内・最大20件）へ記録する。モデル自動変更は行わない（表示のみ）
app.get('/api/claude-cost', (req, res) => {
  try {
    const costSummary = getClaudeCostSummary();
    let analysis = null;
    try { analysis = getClaudeCostAnalysis(); } catch (_e) { analysis = null; }
    const currentModels = {
      strategy: getClaudeModelForRole('strategy'),
      writer:   getClaudeModelForRole('writer'),
      reviewer: getClaudeModelForRole('reviewer'),
      defaultClaudeRole: getClaudeModelForRole('__default__'),
    };
    const modelPolicy = {
      version: CLAUDE_MODEL_POLICY_VERSION,
      policy: CLAUDE_MODEL_POLICY,
      currentModels,
      providerChanged: false,
      leader: 'openai',
    };
    let qualityCompare = null;
    try { qualityCompare = buildClaudeModelQualityCompare(currentModels); } catch (_e) { qualityCompare = null; }
    let adoptionStatus = null;
    try { adoptionStatus = buildClaudeModelAdoptionStatus(currentModels, qualityCompare); } catch (_e) { adoptionStatus = null; }
    let qualityMonitor = null;
    const q = req.query || {};
    try {
      const toNum = (v) => (v !== undefined && v !== '' && !isNaN(Number(v))) ? Number(v) : undefined;
      const toCat = (key) => { const s = toNum(q[key]); return s !== undefined ? { score: s } : null; };
      const overall = toNum(q.overall);
      const compareData = overall !== undefined ? {
        overall,
        sampleSize: toNum(q.sampleSize) || 0,
        hook:      toCat('hookScore'),
        cta:       toCat('ctaScore'),
        knowledge: toCat('knowledgeScore'),
        structure: toCat('structureScore'),
        images:    toCat('imagesScore'),
      } : null;
      qualityMonitor = buildClaudeQualityMonitor(compareData);
      // Phase47-4: 実スコアが渡された場合のみ履歴へ記録
      if (compareData && qualityMonitor) {
        recordClaudeQualityHistory({
          workflowId: q.workflowId || null,
          outputType: q.outputType || null,
          model: currentModels,
          overallScore: qualityMonitor.qualityScore,
          status: qualityMonitor.qualityStatus,
          recommendation: qualityMonitor.recommendation,
          cost: costSummary.today ? costSummary.today.costUsd : null,
          tokens: costSummary.today ? (costSummary.today.inputTokens + costSummary.today.outputTokens) : null,
        });
      }
    } catch (_e) { qualityMonitor = null; }
    let qualityHistory = [];
    let qualityTrend = null;
    let qualityWarning = null;
    try { qualityHistory = getClaudeQualityHistory(); } catch (_e) { qualityHistory = []; }
    try { qualityTrend = buildClaudeQualityTrend(); } catch (_e) { qualityTrend = null; }
    try { qualityWarning = buildClaudeQualityWarning(); } catch (_e) { qualityWarning = null; }
    res.json({ ok: true, ...costSummary, analysis, modelPolicy, qualityCompare, adoptionStatus, qualityMonitor, qualityHistory, qualityTrend, qualityWarning });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});
// GET /api/claude-test?agent=writer — Phase36-2: Claude実接続テスト
app.get('/api/claude-test', async (req, res) => {
  const agentId = (req.query.agent || 'writer').trim();
  if (!['writer', 'reviewer', 'strategy'].includes(agentId)) {
    return res.status(400).json({ ok: false, error: 'agent は writer / reviewer / strategy のみ有効です' });
  }
  try {
    const result = await testClaudeAgent(agentId);
    return res.json({ ok: true, agentId, ...result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message, agentId });
  }
});
// ─────────────────────────────────────────────────

app.get('/api/knowledge-stats', async (req, res) => {
  try {
    const [memStats, libResult, custResult, scoreResult] = await Promise.all([
      getCompanyMemDb().getStats(),
      getKnowledgeDb().getAllByGenre(),
      getCustomersDb().getCustomers(),
      getCompanyScoreDb().getScore(),
    ]);
    const s = memStats.stats || {};
    const knowledgeEntries = Object.values(libResult.library || {}).reduce((sum, arr) => sum + arr.length, 0);
    res.json({
      ok: true,
      companyKnowledge: Object.values(s).reduce((a, b) => a + b, 0),
      successCases:     s.success     || 0,
      failureCases:     s.failure     || 0,
      highRatingCases:  s.high_rating || 0,
      complaintCases:   s.complaint   || 0,
      improvementCount: s.improvement || 0,
      knowledgeEntries,
      customerCount:    (custResult.customers || []).length,
    });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 学習記録 API（Supabase永続化）
// ══════════════════════════════════════════════════════════════
// POST /api/learning/record
app.post('/api/learning/record', express.json(), async (req, res) => {
  const { memberId, userMessage, aiReply, rating, improvement, hadStrategyIntervention } = req.body || {};
  if (!memberId || rating === undefined) {
    return res.status(400).json({ ok: false, error: 'memberId / rating は必須です' });
  }
  const r = Number(rating);
  const genre = detectGenre(userMessage || '');
  const isSuccess = r >= 4;
  const isFailure = r <= 2;

  // Supabase へ並行書き込み（失敗してもレスポンスは返す）
  const tasks = [
    getLearningDb().upsertLearning({ memberId, genre, isSuccess, isFailure, rating: r, improvement }),
    getCompanyScoreDb().recordRating(r),
    getCompanyMemDb().autoSave({ memberId, genre, userMessage, aiReply, rating: r, improvement }),
  ];
  if (isSuccess && aiReply) {
    tasks.push(getLearningDb().saveBestPractice({ memberId, genre, userMessage, reply: aiReply, rating: r }));
    if (r === 5) {
      tasks.push(getKnowledgeDb().addEntry({ genre, title: (userMessage || '').slice(0, 80), content: (aiReply || '').slice(0, 400), source: memberId }));
    }
  }
  if (isFailure) {
    tasks.push(getLearningDb().saveAvoidPractice({ memberId, genre, userMessage, reason: improvement || '評価低', rating: r }));
  }
  if (hadStrategyIntervention) {
    tasks.push(getCompanyScoreDb().recordStrategyIntervention(isSuccess, r));
  }
  await Promise.allSettled(tasks);

  const scoreResult = await getCompanyScoreDb().getScore();
  res.json({ ok: true, genre, isSuccess, isFailure, companyScore: scoreResult.score });
});

// GET /api/learning/:memberId
app.get('/api/learning/:memberId', async (req, res) => {
  try {
    const result = await getLearningDb().getLearning(req.params.memberId);
    res.json({ ok: true, data: result.data });
  } catch (e) { res.json({ ok: false, data: { byGenre: {} }, error: e.message }); }
});

// GET /api/best-practices/:memberId?genre=
app.get('/api/best-practices/:memberId', async (req, res) => {
  try {
    const result = await getLearningDb().getBestPractices(req.params.memberId, req.query.genre);
    res.json({ ok: true, practices: result.practices });
  } catch (e) { res.json({ ok: true, practices: [] }); }
});

// GET /api/avoid-practices/:memberId?genre=
app.get('/api/avoid-practices/:memberId', async (req, res) => {
  try {
    const result = await getLearningDb().getAvoidPractices(req.params.memberId, req.query.genre);
    res.json({ ok: true, practices: result.practices });
  } catch (e) { res.json({ ok: true, practices: [] }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 会社スコア API（Supabase永続化）
// ══════════════════════════════════════════════════════════════
// POST /api/company-score/revenue
app.post('/api/company-score/revenue', express.json(), async (req, res) => {
  const { revenueContribution } = req.body || {};
  try {
    await getCompanyScoreDb().updateRevenue(revenueContribution);
    res.json({ ok: true, revenueContribution: Number(revenueContribution) || 0 });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// GET /api/company-score
app.get('/api/company-score', async (req, res) => {
  try {
    const [scoreResult, strategyResult] = await Promise.all([
      getCompanyScoreDb().getScore(),
      getCompanyScoreDb().getStrategyLearning(),
    ]);
    res.json({
      ok: true,
      ...scoreResult.score,
      strategyLearning: strategyResult.data,
    });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});
// ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 担当評価 API（Supabase永続化）
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// 担当評価 API（Supabase永続化）
// ══════════════════════════════════════════════════════════════
// GET /api/member-scores
app.get('/api/member-scores', async (req, res) => {
  try {
    const result = await getMemberScoresDb().getAllSummaries();
    res.json({ ok: true, scores: result.scores });
  } catch (e) { res.json({ ok: false, scores: {}, error: e.message }); }
});

// POST /api/member-scores/:memberId  { contribution(1-5), accuracy(1-5), speed(1-5), caseId? }
app.post('/api/member-scores/:memberId', express.json(), async (req, res) => {
  const { memberId } = req.params;
  const { contribution, accuracy, speed, caseId } = req.body || {};
  if (!contribution || !accuracy || !speed) {
    return res.status(400).json({ ok: false, error: 'contribution / accuracy / speed は必須です（1〜5）' });
  }
  try {
    const result = await getMemberScoresDb().recordScore({ memberId, caseId, contribution, accuracy, speed });
    res.json({ ok: !result.error, memberId, error: result.error });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/member-scores/dispatch-weights
app.get('/api/member-scores/dispatch-weights', async (req, res) => {
  try {
    const result = await getMemberScoresDb().getDispatchWeights();
    res.json({ ok: true, weights: result.weights });
  } catch (e) { res.json({ ok: false, weights: {}, error: e.message }); }
});
// ─────────────────────────────────────────────────

// GET /api/messages?userId=&memberId=&channel=
app.get('/api/messages', async (req, res) => {
  const { userId = 'web-user', memberId, channel = 'web' } = req.query;
  if (!memberId) return res.status(400).json({ ok: false, error: 'memberId は必須です' });
  try {
    const { getMessages } = require('./lib/conversationsDb');
    const messages = await getMessages({ userId, memberId, channel });
    console.log(`[GET /api/messages] userId=${userId} memberId=${memberId} channel=${channel} → ${messages.length}件`);
    res.json({ ok: true, messages });
  } catch (e) {
    console.error('[GET /api/messages] error:', e.message);
    res.json({ ok: false, messages: [], error: e.message });
  }
});
// ─────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-line-signature'];
  const body = req.rawBody;

  if (!signature || !body) {
    return res.status(400).send('Bad Request');
  }

  const expectedSignature = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  if (signature !== expectedSignature) {
    return res.status(401).send('Unauthorized');
  }

  const events = req.body.events || [];
  console.log('LINE webhook received events:', JSON.stringify(events, null, 2));

  for (const event of events) {
    console.log('LINE sender userId:', event?.source?.userId || 'unknown');
    if (event.type === 'message' && event.replyToken) {
      const replyPayloads = await getReplyPayload(event, adminUserId, { splitBySpecialist: true });
      const payloads = Array.isArray(replyPayloads) ? replyPayloads : [replyPayloads];

      if (!payloads.length || payloads.some((payload) => !payload)) {
        continue;
      }

      try {
        await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken: event.replyToken,
            messages: payloads,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
      } catch (error) {
        console.error('Failed to reply to LINE message:', error.response?.data || error.message);
      }
    }
  }

  res.status(200).send('OK');
});

// ── personaRegistry → Supabase members 自動同期 ──────────────
// LINE_AGENT_PROFILES に追加された担当を Supabase members テーブルへ upsert する
// conversations テーブルの外部キー制約を満たすために必要
// 既存レコードは上書きしない（is_active=true の新規担当のみ追加）
async function syncProfilesToSupabase() {
  try {
    const { supabase } = require('./lib/supabase');
    if (!supabase) return;
    const { buildFallbackMembers } = require('./openaiClient');
    const profiles = buildFallbackMembers();
    // 既存メンバーIDを取得
    const { data: existing } = await supabase.from('members').select('id');
    const existingIds = new Set((existing || []).map(r => r.id));
    // 未登録の担当のみ insert
    const newOnes = profiles.filter(p => !existingIds.has(p.id));
    if (newOnes.length === 0) return;
    const rows = newOnes.map(p => ({ id: p.id, name: p.name, role: p.role, icon: p.icon, is_active: true }));
    const { error } = await supabase.from('members').insert(rows);
    if (error) console.warn('[syncProfiles] Supabase insert error:', error.message);
    else console.log('[syncProfiles] 新担当をSupabaseに登録:', newOnes.map(p => p.id).join(', '));
  } catch (e) {
    console.warn('[syncProfiles] 同期スキップ:', e.message);
  }
}

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    // 起動後に LINE_AGENT_PROFILES → Supabase members を自動同期
    syncProfilesToSupabase().catch(() => {});
  });
}

module.exports = {
  app,
  determineAssignee,
  createReplyText,
  shouldReplyToEvent,
  getReplyText,
  getReplyPayload,
  resetConversationState,
  isContinuationMessage,
};
