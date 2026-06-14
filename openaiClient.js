const axios = require('axios');
const dotenv = require('dotenv');
const { costTracker, addOpenAIUsage } = require('./costTracker');

dotenv.config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = 'gpt-4.1-nano';
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

function buildSystemPrompt(agent = 'manager') {
  const profiles = {
    manager: {
      name: 'AIマネージャー｜蓮',
      role: '担当の要件を整理し、最適な方針を提案する。',
      tone: '丁寧で落ち着いた頼れる口調。',
    },
    web: {
      name: 'Web担当｜葵',
      role: 'Webサイト改善や導線設計を担当する。',
      tone: 'わかりやすく実務寄りで、改善案を具体的に伝える。',
    },
    sns: {
      name: 'SNS動画担当｜レン',
      role: 'SNS投稿や動画企画を担当する。',
      tone: 'テンポよく、行動喚起を強める口調。',
    },
    ai: {
      name: 'AI開発担当｜Code',
      role: 'AIシステムや自動化の実装方針を担当する。',
      tone: '技術的で、実装観点を重視する。',
    },
    estimate: {
      name: '見積担当｜匠',
      role: '見積・数量拾い・価格整理を担当する。',
      tone: '誠実で、現場感のある口調。',
    },
  };

  const profile = profiles[agent] || profiles.manager;
  return [
    `あなたは${profile.name}です。`,
    `役割: ${profile.role}`,
    `口調: ${profile.tone}`,
    'ユーザーの要望を要約し、すぐ使える提案文を返してください。',
    '日本語で、短く、実務的に答えてください。',
  ].join('\n');
}

async function generateReply({ messageText = '', assignee = 'leader', history = [] }) {
  const normalizedAssignee = assignee || 'leader';
  const agent = normalizedAssignee === 'estimate'
    ? 'estimate'
    : normalizedAssignee === 'sns' || normalizedAssignee === 'video'
      ? 'sns'
      : normalizedAssignee === 'writer' || normalizedAssignee === 'designer'
        ? 'web'
        : normalizedAssignee === 'ai'
          ? 'ai'
          : 'manager';

  if (!OPENAI_API_KEY) {
    return {
      text: null,
      usedOpenAI: false,
      model: null,
      usage: null,
    };
  }

  if (!costTracker.canProcess()) {
    return {
      text: null,
      usedOpenAI: false,
      model: null,
      usage: null,
    };
  }

  try {
    const historyMessages = (history || []).map(({ role, content }) => ({ role, content }));
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: buildSystemPrompt(agent),
          },
          ...historyMessages,
          {
            role: 'user',
            content: messageText,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const outputText = response?.data?.output_text || response?.data?.output?.[0]?.content?.[0]?.text || '';
    const usage = response?.data?.usage || {};
    const inputTokens = usage.input_tokens || usage.inputTokens || 0;
    const outputTokens = usage.output_tokens || usage.outputTokens || 0;

    if (inputTokens || outputTokens) {
      addOpenAIUsage(OPENAI_MODEL, inputTokens, outputTokens, 'aiDevelopment', 'text');
    }

    return {
      text: outputText || null,
      usedOpenAI: true,
      model: OPENAI_MODEL,
      usage: {
        input_tokens: Number(inputTokens) || 0,
        output_tokens: Number(outputTokens) || 0,
      },
    };
  } catch (error) {
    console.error('OpenAI request failed:', error.response?.data || error.message);
    return {
      text: null,
      usedOpenAI: false,
      model: null,
      usage: null,
    };
  }
}

module.exports = {
  generateReply,
  buildSystemPrompt,
  OPENAI_MODEL,
};
