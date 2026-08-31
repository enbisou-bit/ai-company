'use strict';
// outputDraftCarouselParser.test.js
// Output Draft Parser P2（B案）: Instagram Carousel の Leader Final → structured fields 変換の回帰テスト。
// 実AI API呼び出し0件 / DB変更なし / 実案件への操作0（index.html から実関数を静的抽出して Node で実行）。
//
//   背景（実運用 wf-1788170283441 / out_1788170314753 で実測）:
//     gpt-5.4-mini の Leader Final は LEADER_FINAL_PROMPT テンプレート
//       ### Instagram投稿（カルーセル）→【N枚目】… / ### キャプション / ### CTA / ### ハッシュタグ / ### 画像生成Prompt
//     で正常出力していたが、既存 parser が【N枚目】を認識せず
//       slides 10→1 / imagePrompts 10→1(stub) / CTA 誤取得(画像プロンプト断片) / #PR 重複
//     となっていた（CONTENT READY / PARSER BLOCKED）。
//
//   B案（今回）:
//     1. extractSlides() に【N枚目】/【スライドN】を追加（既存3形式は不変）
//     2. _parseLeaderFinalCarouselSections() を新設（### セクション分割のみ・新規文字列を生成しない）
//     3. INSTAGRAM_CAROUSEL 分岐: セクションが取れたときだけ slides/imagePrompts/cta を上書き、hashtags を重複除去
//        セクション不在の旧形式では found:false → 現行 heuristic へ完全 fallback
//   今回対象外: packageQuality / completionAssessment 乖離、targetAudience/benefit fallback、caption=fullText、hashtag 上限。

const fs = require('fs');
const path = require('path');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ── index.html から実関数を静的抽出（波括弧バランスで本体を切り出す） ──────────
function extractFn(name, startNeedle) {
  const i = src.indexOf(startNeedle);
  if (i < 0) throw new Error('not found: ' + startNeedle);
  let depth = 0, started = false, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) { j++; break; } }
  }
  return src.slice(i, j);
}

const _parseSrc  = extractFn('_parseLeaderFinalCarouselSections', 'function _parseLeaderFinalCarouselSections(');
const _slidesSrc = extractFn('extractSlides', 'function extractSlides(text) {');

// eval して実体を得る（外部依存なし・純関数）
// eslint-disable-next-line no-eval
const _parseLeaderFinalCarouselSections = eval('(' + _parseSrc + ')');
// eslint-disable-next-line no-eval
const extractSlides = eval('(' + _slidesSrc + ')');

// 実運用 out_1788170314753 の実 Leader Final（gpt-5.4-mini・2713字）を fixture として使用
const REAL_LEADER_FINAL = [
  '### Instagram投稿（カルーセル）',
  '',
  '【1枚目】タイトル：はじめまして、ナチュラルエッセンスです / 本文：自然由来の美容と健康情報を、資料・比較重視でわかりやすくお届けします。今回は第1投稿として、A8.netの提携商品「プラファスト」をご紹介します。 / ビジュアル：清潔感のあるナチュラルテイストの表紙。',
  '',
  '【2枚目】タイトル：プラファストとは？ / 本文：A8.netで提携中のスキンケア商品です。まずは「どんな商品か」を、公式ページで確認できる入口としてご覧ください。 / ビジュアル：商品名を中心にしたシンプルな情報カード風デザイン。',
  '',
  '【3枚目】タイトル：まず確認したいポイント / 本文：商品名、カテゴリ、提携状態、公式ページの有無。 / ビジュアル：チェックリスト風のレイアウト。',
  '',
  '【4枚目】タイトル：商品事実は公式ページで / 本文：成分・使用感・対象など、商品固有の情報は公式ページで確認してください。 / ビジュアル：公式ページ確認を促す中立的な案内画面。',
  '',
  '【5枚目】タイトル：安心して見るための見方 / 本文：初めての商品は、いきなり判断せず、公式情報を順番に確認するのがおすすめです。 / ビジュアル：3ステップの流れを図解したミニマルデザイン。',
  '',
  '【6枚目】タイトル：A8.netの提携商品です / 本文：この投稿は、A8.netの提携情報をもとにご紹介しています。詳細はプロフィールのリンク先でご確認ください。 / ビジュアル：提携情報を伝えるカード。',
  '',
  '【7枚目】タイトル：こんな見方がしやすいです / 本文：「何の商品か」「どこで確認できるか」「自分が気になる点は何か」を分けて見ると整理しやすくなります。 / ビジュアル：3分割の整理ボックス。',
  '',
  '【8枚目】タイトル：保存してあとで見返す / 本文：気になったら保存して、公式ページとあわせて確認してください。 / ビジュアル：保存アイコンを使ったシンプルなリマインド演出。',
  '',
  '【9枚目】タイトル：フォローで次回もチェック / 本文：ナチュラルエッセンスでは、今後も美容・健康情報を資料感のある形で整理してお届けします。 / ビジュアル：次回予告のような落ち着いた締めカード。',
  '',
  '【10枚目】タイトル：最後に / 本文：プラファストの詳細は、プロフィールのリンクから公式ページでご確認ください。 / ビジュアル：CTAを中心にした締めの画面。',
  '',
  '### キャプション（そのままコピペできる完成文）',
  '',
  '【広告】A8.netの提携商品「プラファスト」をご紹介します。詳細は公式ページでご確認ください。',
  '',
  'ナチュラルエッセンスは、自然由来の美容と健康情報を、資料・比較重視でわかりやすく発信するアカウントです。',
  '商品固有の情報は、公式ページでご確認ください。',
  '',
  '#PR',
  '',
  '### CTA',
  'プロフィールのリンクから公式ページをご確認ください。',
  '',
  '### ハッシュタグ',
  '#PR #ナチュラルエッセンス #プラファスト #A8net #A8ネット #スキンケア #美容 #健康 #美容情報 #健康情報 #公式ページで確認 #広告 #カルーセル投稿 #Instagram投稿 #情報発信 #資料重視 #比較重視 #ナチュラルライフ #美容アカウント #健康アカウント',
  '',
  '### 画像生成Prompt',
  '',
  '【1枚目】',
  '清潔感のあるナチュラルテイストのInstagramカルーセル表紙、落ち着いたベージュと白を基調、植物の暗示は控えめ、中立的で信頼感のあるデザイン、正方形',
  '',
  '【2枚目】',
  'シンプルな情報カード風Instagramデザイン、商品名「プラファスト」を中央に配置、清潔感のある配色、正方形',
  '',
  '【3枚目】',
  'チェックリスト風のInstagramカルーセル、4項目を整理して見せる資料デザイン、正方形',
  '',
  '【4枚目】',
  '中立的な案内画面風のInstagramデザイン、公式ページ確認を促す導線、過度な装飾なし、正方形',
  '',
  '【5枚目】',
  '3ステップの流れを図解したInstagram投稿デザイン、ミニマルな線画アイコン、正方形',
  '',
  '【6枚目】',
  'A8.net提携情報を伝えるカード型Instagramデザイン、事実を整理して見せる、正方形',
  '',
  '【7枚目】',
  '3分割の整理ボックスを使ったInstagramデザイン、視認性重視、正方形',
  '',
  '【8枚目】',
  '保存を促すリマインド風Instagramデザイン、保存アイコンを控えめに配置、正方形',
  '',
  '【9枚目】',
  '次回予告のようなInstagramデザイン、ナチュラルエッセンスの世界観を表す清潔感ある背景、フォローを自然に促す、正方形',
  '',
  '【10枚目】',
  '締めのCTA用Instagramデザイン、プロフィールリンク確認を促す中立的な案内、過度な商品演出なし、正方形',
].join('\n');

// INSTAGRAM_CAROUSEL 分岐の overlay を実装どおりに再現（テスト内で index.html のロジックと等価な処理を実行）
function applyCarouselOverlay(finalText) {
  const _lfSec = _parseLeaderFinalCarouselSections(finalText);
  // 旧 heuristic 相当（テスト用の最小スタブ）
  let fields = {
    slides: extractSlides(_lfSec.slides != null ? _lfSec.slides : finalText),
    caption: finalText,
    cta: '次回予告のようなInstagramデザイン、ナチュラルエッセンスの世界観を表す清潔感ある背景、フォローを自然に促す、正方形', // 誤取得(実測)を模擬
    hashtags: ['#PR', '#PR', '#ナチュラルエッセンス', '#プラファスト', '#A8net'],
    imagePrompts: null, // 直後に stub をセット
  };
  fields.imagePrompts = fields.slides.map(s => 'Instagramスライド用画像プロンプト: ' + String(s).slice(0, 60));
  // ── overlay（index.html の該当ブロックと等価） ──
  if (_lfSec.found) {
    if (_lfSec.imagePrompts != null) {
      const _ip = extractSlides(_lfSec.imagePrompts)
        .map(s => String(s).replace(/^【\s*(?:\d+\s*枚目|スライド\s*\d+)\s*】[\s　]*/, '').trim())
        .filter(Boolean);
      if (_ip.length) fields.imagePrompts = _ip;
    }
    if (_lfSec.cta != null) {
      const _ctaLine = _lfSec.cta.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
      if (_ctaLine) fields.cta = _ctaLine;
    }
  }
  if (Array.isArray(fields.hashtags)) {
    fields.hashtags = fields.hashtags.filter((h, i, a) => a.indexOf(h) === i);
  }
  return { fields, _lfSec };
}

// ── 1. extractSlides: 【N枚目】/【スライドN】認識 ──────────────────────────
caseHeader('1. extractSlides()【N枚目】/【スライドN】認識');
{
  const sec = _parseLeaderFinalCarouselSections(REAL_LEADER_FINAL).slides;
  const slides = extractSlides(sec);
  assert(slides.length === 10, `1-1. カルーセルセクションから slides 10枚（実際: ${slides.length}）`);
  assert(/^【1枚目】/.test(slides[0]), '1-2. 1枚目が【1枚目】で始まる');
  assert(slides[0].indexOf('タイトル：') !== -1 && slides[0].indexOf('本文：') !== -1, '1-3. 各slideに見出し(タイトル)・本文が保持されている');
  assert(slides[9].indexOf('最後に') !== -1, '1-4. 10枚目の内容が保持されている');
  assert(extractSlides('【スライド1】A\n【スライド2】B').length === 2, '1-5.【スライドN】形式も2枚に分割される');
}

// ── 2. 既存3形式の非破壊（回帰） ──────────────────────────────────────
caseHeader('2. 既存スライド形式の非破壊（回帰）');
{
  assert(extractSlides('Slide 1: A\nSlide 2: B\nSlide 3: C').length === 3, '2-1. "Slide N" 3枚（既存）');
  assert(extractSlides('スライド1 A\nスライド2 B').length === 2, '2-2. "スライドN" 2枚（既存）');
  assert(extractSlides('① A\n② B\n③ C\n④ D').length === 4, '2-3. 丸数字 4枚（既存）');
  assert(extractSlides('1. A\n2. B').length === 2, '2-4. "N." 2枚（既存）');
  assert(extractSlides('1) A\n2) B\n3) C').length === 3, '2-5. "N)" 3枚（既存）');
  const noMark = extractSlides('見出しなしの本文だけ');
  assert(noMark.length === 1 && noMark[0].length <= 200, '2-6. マーカーなし → 200字fallback 1枚（既存挙動）');
}

// ── 3. _parseLeaderFinalCarouselSections: セクション分割 ────────────────
caseHeader('3. _parseLeaderFinalCarouselSections()');
{
  const r = _parseLeaderFinalCarouselSections(REAL_LEADER_FINAL);
  assert(r.found === true, '3-1. found:true（テンプレート準拠）');
  assert(r.slides && r.slides.indexOf('【1枚目】') !== -1 && r.slides.indexOf('【１０枚目】') === -1 && r.slides.indexOf('【10枚目】') !== -1, '3-2. slides セクションに【1枚目】〜【10枚目】が含まれる');
  assert(r.caption && r.caption.indexOf('【広告】') === 0, '3-3. caption セクションが【広告】で始まる');
  assert(r.cta && r.cta.trim() === 'プロフィールのリンクから公式ページをご確認ください。', '3-4. cta セクションが実CTA文のみ');
  assert(r.hashtags && r.hashtags.indexOf('#PR') !== -1, '3-5. hashtags セクションを取得');
  assert(r.imagePrompts && r.imagePrompts.indexOf('清潔感のあるナチュラル') !== -1, '3-6. imagePrompts セクションを取得');
  assert(r.slides.indexOf('清潔感のあるナチュラルテイストのInstagramカルーセル表紙') === -1, '3-7. slides セクションに画像プロンプト本文が混入していない（セクション境界が正しい）');
}

// ── 4. 旧形式（### なし）→ 完全 fallback ────────────────────────────
caseHeader('4. ### セクション不在 → 現行 heuristic へ完全 fallback');
{
  const legacy = 'Slide 1: こんにちは\nSlide 2: よろしく\nフォローしてね';
  const r = _parseLeaderFinalCarouselSections(legacy);
  assert(r.found === false, '4-1. ### 見出しなし → found:false');
  assert(r.slides === null && r.cta === null && r.imagePrompts === null, '4-2. 全セクション null');
  const o = applyCarouselOverlay(legacy);
  assert(o.fields.slides.length === 2, '4-3. fallback: extractSlides(finalText) で 2枚');
  assert(o.fields.imagePrompts.length === 2 && /^Instagramスライド用画像プロンプト:/.test(o.fields.imagePrompts[0]), '4-4. fallback: imagePrompts は現行 stub のまま（後方互換）');
  assert(o.fields.cta === '次回予告のようなInstagramデザイン、ナチュラルエッセンスの世界観を表す清潔感ある背景、フォローを自然に促す、正方形', '4-5. fallback: cta は overlay で上書きされない（_extractCtaFromText 結果を維持）');
}

// ── 5. overlay: imagePrompts 実10枚化 ────────────────────────────────
caseHeader('5. imagePrompts: 実プロンプト10枚');
{
  const o = applyCarouselOverlay(REAL_LEADER_FINAL);
  assert(o.fields.imagePrompts.length === 10, `5-1. imagePrompts.length === 10（実際: ${o.fields.imagePrompts.length}）`);
  assert(o.fields.imagePrompts.every(p => p.indexOf('Instagramスライド用画像プロンプト:') === -1), '5-2. stub プレフィックスが1つも含まれない（実プロンプト）');
  assert(o.fields.imagePrompts[0].indexOf('清潔感のあるナチュラルテイスト') === 0, '5-3. 1枚目が実プロンプト本文で始まる（【N枚目】マーカー除去済み）');
  assert(o.fields.imagePrompts[8].indexOf('フォローを自然に促す') !== -1, '5-4. 9枚目の実プロンプト内容が保持されている');
  assert(o.fields.imagePrompts.every(p => /【\s*\d+\s*枚目\s*】/.test(p) === false), '5-5. 各プロンプトから【N枚目】マーカーが除去されている');
}

// ── 6. overlay: CTA 正値化 ──────────────────────────────────────────
caseHeader('6. CTA: ### CTA セクションを優先');
{
  const o = applyCarouselOverlay(REAL_LEADER_FINAL);
  assert(o.fields.cta === 'プロフィールのリンクから公式ページをご確認ください。', '6-1. cta が ### CTA セクションの実文');
  assert(o.fields.cta.indexOf('デザイン') === -1 && o.fields.cta.indexOf('正方形') === -1, '6-2. cta が画像プロンプト断片（デザイン/正方形）ではない');
}

// ── 7. overlay: hashtags 重複除去 ──────────────────────────────────
caseHeader('7. hashtags: #PR 重複除去（順序保持）');
{
  const o = applyCarouselOverlay(REAL_LEADER_FINAL);
  const prCount = o.fields.hashtags.filter(h => h === '#PR').length;
  assert(prCount === 1, `7-1. #PR は1個のみ（実際: ${prCount}）`);
  assert(o.fields.hashtags[0] === '#PR', '7-2. 順序保持（先頭 #PR）');
  assert(o.fields.hashtags.length === new Set(o.fields.hashtags).size, '7-3. 全要素が一意');
}

// ── 8. hashtag 上限仕様は変更していない（静的確認） ─────────────────
caseHeader('8. hashtag 上限・_extractHashtagsFromText 本体は不変');
{
  assert(src.indexOf('return matches ? matches.slice(0, 10) : [];') !== -1, '8-1. _extractHashtagsFromText の slice(0,10) が不変');
  assert(src.indexOf('fields.hashtags = fields.hashtags.filter(function(h, i, a){ return a.indexOf(h) === i; });') !== -1, '8-2. overlay の dedupe は分岐内 filter のみ（本体非変更）');
}

// ── 9. slides の overlay 経路（カルーセルセクションのみを渡す） ──────
caseHeader('9. slides: カルーセルセクションのみを extractSlides へ');
{
  const o = applyCarouselOverlay(REAL_LEADER_FINAL);
  assert(o.fields.slides.length === 10, `9-1. slides.length === 10（実際: ${o.fields.slides.length}）`);
  assert(o.fields.slides.every(s => s.indexOf('タイトル：') !== -1), '9-2. 各 slide に見出し(タイトル：)がある');
  assert(o.fields.slides.every(s => s.indexOf('正方形') === -1), '9-3. slides に画像プロンプト本文（正方形）が混入していない');
  assert(src.indexOf('var _slidesCar = extractSlides(_lfSec.slides != null ? _lfSec.slides : finalText);') !== -1, '9-4. index.html: _slidesCar がセクション優先で生成される');
}

// ── 10. 今回対象外フィールドの非変更（静的確認） ───────────────────
caseHeader('10. 今回対象外（packageQuality / completionAssessment / targetAudience / benefit / caption）は不変');
{
  // packageQuality の IADP routing ブロックが無変更
  assert(src.indexOf("if (_iadpQ && _iadpPkgId && _iadpIsValid && typeof _iadpQ.status === 'string' && typeof _iadpQ.score === 'number') {") !== -1, '10-1. Phase IG-QC の routing 条件が無変更');
  assert(src.indexOf('_lastOutputDraft.completionAssessment = evaluateDeliverableCompletion(_lastOutputDraft, { userApproval: _compUserApproval });') !== -1, '10-2. completionAssessment 接続が無変更');
  // caption は依然 fullText（overlay で caption を触っていない）
  assert(src.indexOf("var _ip = extractSlides(_lfSec.imagePrompts)") !== -1
      && src.slice(src.indexOf('if (_lfSec.found) {'), src.indexOf('updatedFields = [\'slides\', \'caption\', \'cta\', \'hashtags\', \'imagePrompts\'')).indexOf('fields.caption') === -1,
      '10-3. overlay ブロックで fields.caption を上書きしていない');
  // targetAudience/benefit の行が無変更
  assert(src.indexOf("fields.targetAudience = _extractLabeledSection(searchText, [/^[■●◆\\-\\*]?\\s*(ターゲット層?|想定読者|Target\\s*Audience)\\s*[:：]/i], searchText.slice(0, 100));") !== -1, '10-4. targetAudience の fallback 行が無変更');
}

// ── 11. parser が新しい商品事実を生成しない ───────────────────────
caseHeader('11. parser は Leader Final 本文の抽出のみ（新規文字列を生成しない）');
{
  const o = applyCarouselOverlay(REAL_LEADER_FINAL);
  const allText = [].concat(o.fields.slides, o.fields.imagePrompts, [o.fields.cta], o.fields.hashtags).join('\n');
  // Leader Final 本文に存在しない文字列が出力に現れていないこと（サンプル: 未確認商品事実語）
  const BANNED = ['天然成分', '植物由来成分', '肌に優しい', '敏感肌対応', '保湿効果', 'キャンペーン中', '高評価の口コミ'];
  assert(BANNED.every(w => allText.indexOf(w) === -1), '11-1. 未確認商品事実語が0件（parser は抽出のみ）');
  // 出力の各文字列が finalText の部分列であること（imagePrompts はマーカー除去のみ）
  assert(o.fields.imagePrompts.every(p => REAL_LEADER_FINAL.indexOf(p) !== -1), '11-2. imagePrompts は finalText の部分文字列（生成でなく抽出）');
  assert(REAL_LEADER_FINAL.indexOf(o.fields.cta) !== -1, '11-3. cta は finalText の部分文字列');
}

// ── 12. 非Instagram Output への影響なし（静的確認） ─────────────────
caseHeader('12. 非Instagram Output は未変更');
{
  // overlay は INSTAGRAM_CAROUSEL 分岐内のみ
  const carBranch = src.slice(src.indexOf('if (type === OUTPUT_TYPES.INSTAGRAM_CAROUSEL) {'), src.indexOf('} else if (type === OUTPUT_TYPES.INSTAGRAM_POST) {'));
  assert(carBranch.indexOf('_parseLeaderFinalCarouselSections') !== -1, '12-1. _lfSec overlay は INSTAGRAM_CAROUSEL 分岐内にある');
  const afterCar = src.slice(src.indexOf('} else if (type === OUTPUT_TYPES.INSTAGRAM_POST) {'));
  assert(afterCar.indexOf('_parseLeaderFinalCarouselSections') === -1, '12-2. INSTAGRAM_POST 以降の分岐に overlay は無い');
  // extractSlides の追加は POWERPOINT でも有効だが「追加のみ・既存形式非破壊」であることを 2-x で担保
  assert(src.indexOf("|| /^【\\s*(\\d+\\s*枚目|スライド\\s*\\d+)\\s*】/.test(t)) {") !== -1, '12-3. extractSlides の追加条件は既存3条件へ OR 追加（置換していない）');
}

console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
console.log(_failed === 0 ? '🟢 All Output Draft Carousel Parser cases passed' : '🔴 FAILED');
process.exitCode = _failed === 0 ? 0 : 1;
