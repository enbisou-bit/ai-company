// claudeClient.js — Phase27: Claude API Provider（Writer / Reviewer / Strategy）
// 既存 openaiClient.js は変更しない。Claude担当のみこのファイルで処理する。

const { buildSystemPrompt } = require('./openaiClient');

// Claude対象社員
const CLAUDE_AGENTS = new Set(['writer', 'reviewer', 'strategy']);

// 社員別Claude実モデルID（AI_MODEL_SETTINGS の model名 → 実ID）
const CLAUDE_MODEL_MAP = {
  writer:   'claude-sonnet-4-6',
  reviewer: 'claude-sonnet-4-6',
  strategy: 'claude-opus-4-8',
};
const CLAUDE_FALLBACK_MODEL = 'claude-sonnet-4-6';

// Claude料金概算（1000トークン単価 USD）
const CLAUDE_PRICE_PER_1K = {
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-opus-4-8':   { input: 0.015, output: 0.075 },
};

// In-memory 利用量トラッキング（再起動でリセット）
const claudeUsage = {
  today: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  month: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  lastRequest: null,
  lastAgent: null,
  lastModel: null,
  status: 'not_configured', // not_configured / ready / error
  errorMsg: null,
};

// APIキー確認（起動時）
function initClaudeStatus() {
  const key = process.env.ANTHROPIC_API_KEY;
  claudeUsage.status = key ? 'ready' : 'not_configured';
}
initClaudeStatus();

// Anthropic クライアント（遅延初期化）
let _anthropic = null;
function getAnthropicClient() {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const { default: Anthropic } = require('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

// 利用量更新
function trackUsage(model, inputTokens, outputTokens) {
  const price = CLAUDE_PRICE_PER_1K[model] || CLAUDE_PRICE_PER_1K[CLAUDE_FALLBACK_MODEL];
  const cost = (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
  claudeUsage.today.requests++;
  claudeUsage.today.inputTokens  += inputTokens;
  claudeUsage.today.outputTokens += outputTokens;
  claudeUsage.today.costUsd      += cost;
  claudeUsage.month.requests++;
  claudeUsage.month.inputTokens  += inputTokens;
  claudeUsage.month.outputTokens += outputTokens;
  claudeUsage.month.costUsd      += cost;
  claudeUsage.lastRequest = new Date().toISOString();
}

// Claude API 呼び出し（Fallback: エラー時は null を返す）
async function callClaudeAI(systemPrompt, userMessage, history = [], agentId = 'writer') {
  const client = getAnthropicClient();
  if (!client) return null; // APIキー未設定 → Fallback

  const model = CLAUDE_MODEL_MAP[agentId] || CLAUDE_FALLBACK_MODEL;
  const messages = [
    ...history.slice(-10).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });
    const text = response.content?.[0]?.text || '';
    trackUsage(model, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);
    claudeUsage.status = 'ready';
    claudeUsage.lastAgent = agentId;
    claudeUsage.lastModel = model;
    claudeUsage.errorMsg = null;
    return text;
  } catch (e) {
    claudeUsage.status = 'error';
    claudeUsage.errorMsg = e.message;
    return null; // エラー → Fallback
  }
}

// generateClaudeReply — Phase25の knowledgeContext 対応
// OpenAI Fallback 込み（APIキー未設定 / エラー時）
async function generateClaudeReply({
  messageText = '',
  assignee = 'writer',
  history = [],
  bestPractices = [],
  avoidPractices = [],
  companyContext = '',
  strategyContext = '',
  memberData = null,
  knowledgeContext = '',
}) {
  // 既存の buildSystemPrompt を流用（プロンプト内容はOpenAIと同じ）
  const practiceData = (bestPractices.length > 0 || avoidPractices.length > 0 || companyContext || strategyContext)
    ? { bestPractices, avoidPractices, companyContext, strategyContext }
    : null;
  let systemPrompt = buildSystemPrompt(assignee, practiceData, memberData);
  if (knowledgeContext) systemPrompt += '\n' + knowledgeContext;

  // Claude 呼び出し（失敗時は null）
  const claudeText = await callClaudeAI(systemPrompt, messageText, history, assignee);
  if (claudeText !== null) {
    return { text: claudeText, provider: 'claude', model: CLAUDE_MODEL_MAP[assignee] || CLAUDE_FALLBACK_MODEL, fallback: false };
  }

  // Fallback: OpenAI へ切り替え
  console.warn(`[Claude Fallback] ${assignee} → OpenAI fallback. reason: ${claudeUsage.errorMsg || 'no key'}`);
  const { generateReply } = require('./openaiClient');
  const result = await generateReply({ messageText, assignee, history, bestPractices, avoidPractices, companyContext, strategyContext, memberData, knowledgeContext });
  return { ...result, provider: 'openai_fallback', fallback: true };
}

// Phase36-2: Claude接続テスト（社員別 / 実API呼び出し / Token・時間計測）
async function testClaudeAgent(agentId = 'writer') {
  const model = CLAUDE_MODEL_MAP[agentId] || CLAUDE_FALLBACK_MODEL;
  const client = getAnthropicClient();
  if (!client) {
    return { success: false, error: 'ANTHROPIC_API_KEY未設定', httpStatus: null, model, inputTokens: 0, outputTokens: 0, elapsedMs: 0 };
  }
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 32,
      system: `You are ${agentId} of ENBISOU AI COMPANY.`,
      messages: [{ role: 'user', content: '接続確認テストです。「接続確認完了」とだけ返答してください。' }],
    });
    const text = response.content?.[0]?.text || '';
    const inputTokens  = response.usage?.input_tokens  || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    trackUsage(model, inputTokens, outputTokens);
    claudeUsage.status    = 'ready';
    claudeUsage.lastAgent = agentId;
    claudeUsage.lastModel = model;
    claudeUsage.errorMsg  = null;
    return { success: true, text, model, inputTokens, outputTokens, elapsedMs: Date.now() - start };
  } catch (e) {
    claudeUsage.status   = 'error';
    claudeUsage.errorMsg = e.message;
    return { success: false, error: e.message, httpStatus: e.status || null, model, inputTokens: 0, outputTokens: 0, elapsedMs: Date.now() - start };
  }
}

module.exports = {
  CLAUDE_AGENTS,
  CLAUDE_MODEL_MAP,
  callClaudeAI,
  generateClaudeReply,
  claudeUsage,
  initClaudeStatus,
  testClaudeAgent,
};
