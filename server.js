const express = require('express');
const dotenv = require('dotenv');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const { costTracker, resetCostTracker } = require('./costTracker');
const { generateReply } = require('./openaiClient');
const { loadHistory, addMessage, getLastAssignee, setLastAssignee } = require('./conversationHistory');

dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3000;
const channelSecret = process.env.LINE_CHANNEL_SECRET;
const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const adminUserId = process.env.ADMIN_LINE_USER_ID || '';
const conversationStates = new Map();

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
  const replies = [];

  if (/(料金|コスト)/.test(normalizedText)) {
    return costTracker.getMeterText();
  }

  if (normalizedText.includes('停止')) {
    costTracker.stopProcessing();
    return '🛑 APIを停止しました。';
  }

  if (normalizedText.includes('再開')) {
    costTracker.resumeProcessing();
    return '✅ APIを再開しました。';
  }

  if (/^上限変更\s*(\d+)$/.test(normalizedText)) {
    const limit = Number(normalizedText.match(/^上限変更\s*(\d+)$/)[1]);
    costTracker.setMonthlyLimit(limit);
    return `✅ 月額上限を${limit}円に変更しました。`;
  }

  if (normalizedText.includes('状態')) {
    return costTracker.getStatusText();
  }

  if (normalizedText.includes('テスト')) {
    return '👑 AIマネージャー｜蓮\n接続テストOKです。\nLINE連携は正常に動いています。';
  }

  if ((costTracker.isLimitExceeded() || costTracker.getSummary().stopped) && /(チラシ|広告|デザイン|ホームページ|hp|サイト|web|動画|tiktok|リール|ショート|ai|システム|自動化|アプリ|屋根|外壁|見積)/.test(normalizedText)) {
    return costTracker.getStopText();
  }

  if (costTracker.getSummary().stopped) {
    return costTracker.getStopText();
  }

  if (/(チラシ|広告|デザイン)/.test(normalizedText)) {
    replies.push('🎨 デザイン担当｜ミオ\nチラシ・広告・デザイン面を確認します。\n反響が増える見せ方を考えます。');
  }

  if (/(ホームページ|hp|サイト|web)/.test(normalizedText)) {
    replies.push('💻 Web担当｜葵\nホームページ・Web導線を確認します。\n見やすさ、問い合わせ導線、SEOを整理します。');
  }

  if (/(動画|tiktok|リール|ショート)/.test(normalizedText)) {
    replies.push('🎬 SNS動画担当｜レン\n動画・SNS導線を確認します。\nバズ導線と再生維持率を考えて提案します。');
  }

  if (/(ai|システム|自動化|アプリ)/.test(normalizedText)) {
    replies.push('🤖 AI開発担当｜Code\nAIシステム・自動化の内容を確認します。\n構成と実装方法を整理します。');
  }

  if (/(屋根|外壁|見積)/.test(normalizedText)) {
    replies.push('👷 見積担当｜匠\n見積・数量拾いの内容を確認します。\n図面や写真があれば送ってください。');
  }

  const memberName = assignee || 'leader';

  if (replies.length === 0) {
    const history = loadHistory(userId, memberName);
    if (userId) addMessage(userId, memberName, 'user', messageText);
    const openAiReply = await generateReply({ messageText, assignee, history });
    const replyText = openAiReply.text || '👑 AIマネージャー｜蓮\n内容を確認しました。\nどの担当で進めるか判断します。';
    if (openAiReply.text && userId) {
      addMessage(userId, memberName, 'assistant', replyText);
      setLastAssignee(userId, memberName);
    }
    return replyText;
  }

  if (replies.length > 1) {
    replies.unshift('👑 AIマネージャー｜蓮\n複数の担当で進めます。');
  }

  const history = loadHistory(userId, memberName);
  if (userId) addMessage(userId, memberName, 'user', messageText);
  const openAiReply = await generateReply({ messageText, assignee, history });
  if (openAiReply.text) {
    if (userId) {
      addMessage(userId, memberName, 'assistant', openAiReply.text);
      setLastAssignee(userId, memberName);
    }
    return openAiReply.text;
  }

  return replies.join('\n\n');
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

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
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
