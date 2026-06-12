const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { determineAssignee, createReplyText, shouldReplyToEvent, getReplyText, getReplyPayload, resetConversationState } = require('./server');
const { costTracker, resetCostTracker, calculateOpenAICost, addOpenAIUsage } = require('./costTracker');

afterEach(() => {
  resetCostTracker();
});

test('estimate担当を返す', () => {
  assert.equal(determineAssignee('屋根の見積もりをお願いします'), 'estimate');
});

test('sns担当を返す', () => {
  assert.equal(determineAssignee('SNS投稿の内容を作って'), 'sns');
});

test('video担当を返す', () => {
  assert.equal(determineAssignee('ショート動画の台本を作って'), 'video');
});

test('writer担当を返す', () => {
  assert.equal(determineAssignee('ブログ用の文章をお願いします'), 'writer');
});

test('designer担当を返す', () => {
  assert.equal(determineAssignee('チラシのデザインをお願いします'), 'designer');
});

test('どれにも当てはまらない場合はleader担当', () => {
  assert.equal(determineAssignee('会議の件です'), 'leader');
});

test('テストメッセージには接続テスト用の文面を返す', () => {
  resetCostTracker();
  const reply = createReplyText('テスト');

  assert.match(reply, /接続テストOKです/);
  assert.match(reply, /LINE連携は正常に動いています/);
});

test('チラシ・広告・デザインの内容にはデザイン担当の文面を返す', () => {
  resetCostTracker();
  const reply = createReplyText('チラシ改善したいです');

  assert.match(reply, /デザイン担当/);
  assert.match(reply, /チラシ・広告・デザイン面を確認します/);
  assert.match(reply, /反響が増える見せ方を考えます/);
});

test('屋根・外壁・見積の内容には見積担当の文面を返す', () => {
  resetCostTracker();
  const reply = createReplyText('屋根の見積もりをお願いします');

  assert.match(reply, /見積担当/);
  assert.match(reply, /見積・数量拾いの内容を確認します/);
  assert.match(reply, /図面や写真があれば送ってください/);
});

test('複数条件に一致する場合は複数担当をまとめて返す', () => {
  resetCostTracker();
  const reply = createReplyText('チラシ広告とWebサイトを改善したい');

  assert.match(reply, /複数の担当で進めます/);
  assert.match(reply, /デザイン担当/);
  assert.match(reply, /Web担当/);
});

test('料金コマンドで料金メーターが返る', () => {
  resetCostTracker();
  const reply = createReplyText('料金');

  assert.match(reply, /AI料金メーター/);
  assert.match(reply, /本日：0円/);
  assert.match(reply, /今月：0円/);
  assert.match(reply, /月額上限：1000円/);
  assert.match(reply, /残り：1000円/);
  assert.match(reply, /担当別：/);
  assert.match(reply, /・Web担当：0円/);
  assert.match(reply, /・SNS動画担当：0円/);
  assert.match(reply, /・AI開発担当：0円/);
  assert.match(reply, /・見積担当：0円/);
  assert.match(reply, /処理別：/);
  assert.match(reply, /・文章AI：0円/);
  assert.match(reply, /・画像生成：0円/);
  assert.match(reply, /・動画生成：0円/);
  assert.match(reply, /・分析：0円/);
  assert.match(reply, /状態：安全運転中です。/);
});

test('月額上限が1000円である', () => {
  resetCostTracker();
  const summary = costTracker.getSummary();

  assert.equal(summary.monthlyLimit, 1000);
});

test('残り金額が表示される', () => {
  resetCostTracker();
  const reply = createReplyText('コスト');

  assert.match(reply, /月額上限：1000円/);
  assert.match(reply, /残り：1000円/);
});

test('上限超過時に停止判定できる', () => {
  resetCostTracker();
  costTracker.setMonthlyLimit(1000);
  costTracker.recordUsage({ amount: 1001, assignee: 'web', type: 'text' });

  assert.equal(costTracker.isLimitExceeded(), true);
  assert.equal(costTracker.canProcess(), false);
  assert.match(costTracker.getStopText(), /月額上限に達したためAI処理を停止しました/);
});

test('gpt-4.1-miniの料金計算ができる', () => {
  const result = calculateOpenAICost('gpt-4.1-mini', 1000000, 1000000);

  assert.equal(result.usd, 2);
  assert.equal(result.jpy, 320);
});

test('gpt-4.1-nanoの料金計算ができる', () => {
  const result = calculateOpenAICost('gpt-4.1-nano', 1000000, 1000000);

  assert.equal(result.usd, 0.5);
  assert.equal(result.jpy, 80);
});

test('OpenAI usageを加算できる', () => {
  resetCostTracker();
  addOpenAIUsage('gpt-4.1-mini', 1000000, 1000000, 'web', 'text');
  const summary = costTracker.getSummary();

  assert.equal(summary.monthlyAmount, 320);
  assert.equal(summary.byAssignee.web, 320);
  assert.equal(summary.byType.text, 320);
  assert.equal(summary.modelCosts['gpt-4.1-mini'], 320);
});

test('モデル別料金が表示される', () => {
  resetCostTracker();
  addOpenAIUsage('gpt-4.1-mini', 1000000, 1000000, 'web', 'text');
  const reply = createReplyText('料金');

  assert.match(reply, /モデル別：/);
  assert.match(reply, /gpt-4.1-mini：320円/);
  assert.match(reply, /gpt-4.1-nano：0円/);
});

test('月額上限を超えたら停止になる', () => {
  resetCostTracker();
  costTracker.setMonthlyLimit(300);
  addOpenAIUsage('gpt-4.1-mini', 1000000, 1000000, 'web', 'text');
  const summary = costTracker.getSummary();

  assert.equal(summary.stopped, true);
  assert.equal(summary.monthlyAmount, 320);
});

test('リセット後は担当別の旧保持オブジェクトもゼロに戻る', () => {
  resetCostTracker();
  const summary = costTracker.getSummary();

  assert.deepEqual(summary.byAssignee, {
    web: 0,
    snsVideo: 0,
    aiDevelopment: 0,
    estimate: 0,
  });
  assert.deepEqual(summary.byType, {
    text: 0,
    image: 0,
    video: 0,
    analysis: 0,
  });
  assert.deepEqual(summary.agentCosts, {
    web: 0,
    snsVideo: 0,
    aiDevelopment: 0,
    estimate: 0,
  });
  assert.deepEqual(summary.departmentCosts, {
    web: 0,
    snsVideo: 0,
    aiDevelopment: 0,
    estimate: 0,
  });
  assert.deepEqual(summary.breakdown, {
    byAssignee: {
      web: 0,
      snsVideo: 0,
      aiDevelopment: 0,
      estimate: 0,
    },
    byType: {
      text: 0,
      image: 0,
      video: 0,
      analysis: 0,
    },
  });
});

test('停止コマンドでAPI停止状態にできる', () => {
  resetCostTracker();
  const reply = createReplyText('停止');

  assert.match(reply, /APIを停止しました/);
  assert.equal(costTracker.getSummary().stopped, true);
});

test('再開コマンドでAPIを再開できる', () => {
  resetCostTracker();
  costTracker.stopProcessing();
  const reply = createReplyText('再開');

  assert.match(reply, /APIを再開しました/);
  assert.equal(costTracker.getSummary().stopped, false);
});

test('上限変更コマンドで月額上限を変更できる', () => {
  resetCostTracker();
  const reply = createReplyText('上限変更 3000');

  assert.match(reply, /3000円/);
  assert.equal(costTracker.getSummary().monthlyLimit, 3000);
});

test('状態コマンドで現在の停止状態を返す', () => {
  resetCostTracker();
  costTracker.stopProcessing();
  const reply = createReplyText('状態');

  assert.match(reply, /停止中/);
});

test('停止中は通常のAI依頼を止める', () => {
  resetCostTracker();
  costTracker.stopProcessing();
  const reply = createReplyText('Webサイトを改善したい');

  assert.match(reply, /月額上限に達したためAI処理を停止しました/);
});

test('その他の内容にはAIマネージャーの文面を返す', () => {
  resetCostTracker();
  const reply = createReplyText('その他の依頼です');

  assert.match(reply, /AIマネージャー/);
  assert.match(reply, /内容を確認しました/);
});

test('管理者以外のユーザーには返信しない', () => {
  const event = { source: { userId: 'user-123' } };
  assert.equal(shouldReplyToEvent(event, 'admin-1'), false);
});

test('管理者ユーザーには返信する', () => {
  const event = { source: { userId: 'admin-1' } };
  assert.equal(shouldReplyToEvent(event, 'admin-1'), true);
});

test('自分のLINE userIdを返信する', () => {
  const event = {
    source: { userId: 'admin-1' },
    message: { type: 'text', text: '自分のLINE userIdを教えて' },
  };

  assert.equal(getReplyText(event, 'admin-1'), 'あなたのLINE userIdは次の通りです。\nadmin-1');
});

test('管理者ID未設定でも自分のLINE userIdを返信する', () => {
  const event = {
    source: { userId: 'user-123' },
    message: { type: 'text', text: '自分のLINE userIdを教えて' },
  };

  assert.equal(getReplyText(event, ''), 'あなたのLINE userIdは次の通りです。\nuser-123');
});

test('管理者には4択Quick Replyで目的選択を提案する', () => {
  const event = {
    source: { userId: 'admin-1' },
    message: { type: 'text', text: 'チラシ改善したいです' },
  };

  const payload = getReplyPayload(event, 'admin-1');

  assert.equal(payload.type, 'text');
  assert.match(payload.text, /担当|振り分け|要件/);
  assert.doesNotMatch(payload.text, /マネージャー/);
  assert.equal(payload.quickReply.items.length, 4);
  assert.deepEqual(
    payload.quickReply.items.map((item) => item.action.text),
    [
      '問い合わせを増やしたい',
      '見積依頼を増やしたい',
      'LINE登録を増やしたい',
      '信頼感を上げたい',
    ]
  );
});

test('確認系の依頼には確認項目をQuick Replyで提案する', () => {
  const event = {
    source: { userId: 'admin-1' },
    message: { type: 'text', text: '本番公開の確認をしたいです' },
  };

  const payload = getReplyPayload(event, 'admin-1');

  assert.equal(payload.type, 'text');
  assert.match(payload.text, /課金、有料API追加、外部契約、本番公開、削除、大量送信は必ず確認/);
  assert.equal(payload.quickReply.items.length, 4);
});

test('チラシ改善依頼は担当が順に議論し、最後にleaderがまとめる', () => {
  const event = {
    source: { userId: 'admin-1' },
    message: { type: 'text', text: 'チラシを改善したい' },
  };

  resetConversationState('admin-1');

  const payloads = getReplyPayload(event, 'admin-1', { splitBySpecialist: true });

  assert.equal(Array.isArray(payloads), true);
  assert.equal(payloads.length, 5);
  assert.deepEqual(
    payloads.map((payload) => payload.agentKey),
    ['designer', 'marketing', 'writer', 'estimate', 'leader']
  );
  assert.match(payloads[0].text, /【デザイナー】/);
  assert.match(payloads[0].text, /配色|レイアウト/);
  assert.match(payloads[1].text, /デザイナー|反響|問い合わせ/);
  assert.match(payloads[2].text, /デザイン|集客|コピー/);
  assert.match(payloads[3].text, /利益|単価|成約率/);
  assert.match(payloads[4].text, /最終提案|整理|1つ/);
});

test('担当の議論は前の意見を踏まえて進む', () => {
  resetConversationState('admin-1');

  const initialEvent = {
    source: { userId: 'admin-1' },
    message: { type: 'text', text: 'チラシを改善したい' },
  };

  const payloads = getReplyPayload(initialEvent, 'admin-1', { splitBySpecialist: true });

  assert.match(payloads[1].text, /デザイナー/);
  assert.match(payloads[2].text, /デザイン|集客/);
  assert.match(payloads[3].text, /先ほどの意見|前の担当|集客/);
});
