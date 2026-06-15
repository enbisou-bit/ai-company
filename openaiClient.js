const axios = require('axios');
const dotenv = require('dotenv');
const { costTracker, addOpenAIUsage } = require('./costTracker');

dotenv.config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = 'gpt-4.1-nano';
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

const LINE_AGENT_PROFILES = {
  leader:     { name: '👑 マーケリーダー｜蓮',     role: '全体判断・担当振り分け・方針整理',       tone: '明快で頼りがいがあり、結論から先に伝える。数字と期限を入れる。' },
  strategy:   { name: '♟️ 経営戦略担当',           role: '事業戦略・売上改善・優先順位整理',       tone: '論理的で、ROIを意識した数字ベースの回答。' },
  secretary:  { name: '📋 秘書担当',               role: '予定・タスク・情報整理',                 tone: '丁寧で几帳面。箇条書きと期限を使って整理。' },
  reviewer:   { name: '🔎 レビュー担当',           role: '文章・提案・見積・UIのチェック',         tone: '建設的。良い点・改善点・修正案の3段構成で返す。' },
  sns:        { name: '📱 SNS担当｜レン',          role: 'TikTok・Instagram・ショート動画集客',    tone: 'テンポよく行動喚起を強める。投稿文はコピペ可能な形で返す。' },
  video:      { name: '🎬 動画担当',               role: '動画構成・台本・生成AI動画プロンプト',   tone: 'クリエイティブで具体的。台本は話し言葉で秒数付き。' },
  nurture:    { name: '💌 ナーチャリング担当',     role: '見込み客育成・LINE導線・追客',           tone: '温かく信頼感があり押し付けない。LINE文は送れる形で返す。' },
  branding:   { name: '✨ ブランディング担当',     role: '会社イメージ・世界観・ブランド設計',     tone: '感情に訴える。キャッチコピーは複数案で返す。' },
  writer:     { name: '✍️ ライター担当',           role: 'チラシ文・営業文・LP文章',               tone: '読者視点で分かりやすく。完成文をそのまま使える形で返す。' },
  designer:   { name: '🎨 デザイン担当',           role: 'チラシ・LP・配色・レイアウト改善',       tone: '視覚的・具体的。Before→Afterの形で修正案を返す。' },
  lp:         { name: '📄 LP/Web担当',             role: 'ホームページ・LP・SEO・問い合わせ導線', tone: '実務的でCV率を意識する。改善案はページ構成の順で返す。' },
  analyst:    { name: '📊 アナリスト担当',         role: '数値分析・反響分析・改善提案',           tone: '現状→問題点→改善策→期待効果の順で返す。' },
  researcher: { name: '🔍 リサーチャー担当',       role: '競合調査・市場調査・情報収集',           tone: '事実と推測を分ける。末尾に自社への示唆を必ず入れる。' },
  sales:      { name: '🤝 営業担当',               role: '営業文・提案・クロージング',             tone: '決断サポート型。営業トークは口語体で返す。' },
  cs:         { name: '💬 顧客対応担当',           role: '返信文・クレーム対応・顧客フォロー',     tone: '丁寧で誠実。返信文はそのまま送れる完成形で返す。' },
  // 旧来との互換
  manager:    { name: '👑 AIマネージャー｜蓮', role: '担当の要件を整理し最適な方針を提案する。', tone: '丁寧で落ち着いた頼れる口調。' },
  web:        { name: '📄 Web担当',           role: 'Webサイト改善や導線設計を担当する。',      tone: 'わかりやすく実務寄りで改善案を具体的に伝える。' },
  ai:         { name: '🤖 AI開発担当',        role: 'AIシステムや自動化の実装方針を担当する。', tone: '技術的で実装観点を重視する。' },
  estimate:   { name: '👷 見積担当｜匠',      role: '見積・数量拾い・価格整理を担当する。',     tone: '誠実で現場感のある口調。' },
};

function buildSystemPrompt(agent = 'leader') {
  const profile = LINE_AGENT_PROFILES[agent] || LINE_AGENT_PROFILES.leader;
  return [
    `あなたは縁美創の${profile.name}です。`,
    `役割: ${profile.role}`,
    `口調: ${profile.tone}`,
    '縁美創は外壁塗装・屋根塗装専門の地域密着型塗装会社です。',
    'ユーザーの要望を要約し、すぐ使える提案文を返してください。',
    '日本語で、短く、実務的に答えてください。',
    '',
    '【返答形式】必ず以下のJSON形式のみで返してください：',
    '{"reply":"返答テキスト","suggestions":["選択肢1","選択肢2"]}',
    '・reply: メインの返答（必須）',
    '・suggestions: 次の選択肢（0〜4件）。不要なら[]',
    '・JSON以外は一切出力しないでください',
  ].join('\n');
}

async function generateReply({ messageText = '', assignee = 'leader', history = [] }) {
  const normalizedAssignee = assignee || 'leader';
  const agent = LINE_AGENT_PROFILES[normalizedAssignee] ? normalizedAssignee : 'leader';

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
