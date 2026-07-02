// claudeClient.js — Phase27: Claude API Provider（Writer / Reviewer / Strategy）
// 既存 openaiClient.js は変更しない。Claude担当のみこのファイルで処理する。

const { buildSystemPrompt } = require('./openaiClient');
// Phase47-1.6: Claude料金永続化
let _addClaudeCost = null;
try {
  _addClaudeCost = require('./claudeCostTracker').addClaudeUsage;
} catch (_e) {
  console.error('[claudeCostTracker] load error:', _e && _e.message);
}

// Claude対象社員
const CLAUDE_AGENTS = new Set(['writer', 'reviewer', 'strategy']);

// Phase47-2B: Claude Model Policy（モデル最適化 / Provider構成変更なし）
// 実際のモデルIDは既存コード内で定義済みのものを使用（推測追加なし）
// claude-opus-4-8:  既存の高単価モデル（最高品質。従来からstrategyが使用）
// claude-haiku-4-5:  claudeCostTracker.js CLAUDE_PRICE_PER_1K に既存定義された最安モデル
const CLAUDE_MODEL_POLICY_VERSION = '1.0.0';
const CLAUDE_HIGHEST_QUALITY_MODEL = 'claude-opus-4-8';
const CLAUDE_LOWEST_COST_MODEL     = 'claude-haiku-4-5';

const CLAUDE_MODEL_POLICY = {
  strategy: 'highest_quality',
  writer: 'lowest_cost',
  reviewer: 'lowest_cost',
  defaultClaudeRole: 'lowest_cost',
};

// 担当roleに応じたClaudeモデルIDを返す（Leaderには適用しない / Providerは変更しない）
function getClaudeModelForRole(role) {
  const policy = CLAUDE_MODEL_POLICY[role] || CLAUDE_MODEL_POLICY.defaultClaudeRole;
  return policy === 'highest_quality' ? CLAUDE_HIGHEST_QUALITY_MODEL : CLAUDE_LOWEST_COST_MODEL;
}

// 社員別Claude実モデルID（Phase47-2B: getClaudeModelForRole()の結果を反映）
const CLAUDE_MODEL_MAP = {
  writer:   getClaudeModelForRole('writer'),
  reviewer: getClaudeModelForRole('reviewer'),
  strategy: getClaudeModelForRole('strategy'),
};
const CLAUDE_FALLBACK_MODEL = CLAUDE_LOWEST_COST_MODEL;

// Claude料金概算（1000トークン単価 USD）
const CLAUDE_PRICE_PER_1K = {
  'claude-sonnet-4-6': { input: 0.003,  output: 0.015 },
  'claude-opus-4-8':   { input: 0.015,  output: 0.075 },
  'claude-haiku-4-5':  { input: 0.0008, output: 0.004 }, // Phase47-2B: 最安モデル価格追加
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
  // Phase47-1.6: 永続保存
  if (_addClaudeCost) {
    try { _addClaudeCost(model, inputTokens, outputTokens); } catch (_e) {
      console.error('[claudeCostTracker] addClaudeUsage error:', _e && _e.message);
    }
  }
}

// Claude API 呼び出し（Fallback: エラー時は null を返す）
async function callClaudeAI(systemPrompt, userMessage, history = [], agentId = 'writer') {
  const client = getAnthropicClient();
  if (!client) return null; // APIキー未設定 → Fallback

  const model = getClaudeModelForRole(agentId);
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
    return { text: claudeText, provider: 'claude', model: getClaudeModelForRole(assignee), fallback: false };
  }

  // Fallback: OpenAI へ切り替え
  console.warn(`[Claude Fallback] ${assignee} → OpenAI fallback. reason: ${claudeUsage.errorMsg || 'no key'}`);
  const { generateReply } = require('./openaiClient');
  const result = await generateReply({ messageText, assignee, history, bestPractices, avoidPractices, companyContext, strategyContext, memberData, knowledgeContext });
  return { ...result, provider: 'openai_fallback', fallback: true };
}

// Phase36-2: Claude接続テスト（社員別 / 実API呼び出し / Token・時間計測）
async function testClaudeAgent(agentId = 'writer') {
  const model = getClaudeModelForRole(agentId);
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
  // Phase47-2B: Claude Model Policy
  CLAUDE_MODEL_POLICY_VERSION,
  CLAUDE_MODEL_POLICY,
  CLAUDE_HIGHEST_QUALITY_MODEL,
  CLAUDE_LOWEST_COST_MODEL,
  getClaudeModelForRole,
};
