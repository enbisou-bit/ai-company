'use strict';
// mobileReviewGroundedWiring.test.js
// Mobile Review Grounded Output Wiring:
//   Mobile Review / Mobile Approval / Publishing の Instagram Carousel 表示層が、
//   修正済み Output Draft の structured fields（fields.slides / imagePrompts / caption / cta / hashtags）を
//   正本として消費し、theme/benefit/targetAudience からのテンプレ再生成で Leader Final 非準拠コピー
//   （「知らないと損する」「9割が見落とす」等）を作らないことを検証する。
//
//   実AI API呼び出し0件 / DB変更なし / 実案件への操作0（index.html から実関数を静的抽出して Node 実行）。
//
//   検証範囲:
//     1. _icbSlidesFromOutputFields(): fields.slides → Carousel Builder スライド形状（純関数）
//     2. _fillPublishingInstagram(): fields.hashtags 優先・targetAudience/benefit 断片の再生成なし
//     3. index.html 静的配線確認: createInstagramCarouselBuilderDraft / buildOutputDraftFromLeaderFinal
//     4. fallback: 構造化 fields が無い旧形式は従来テンプレ経路を維持

const fs = require('fs');
const path = require('path');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFn(startNeedle) {
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

// eslint-disable-next-line no-eval
const _icbSlidesFromOutputFields = eval('(' + extractFn('function _icbSlidesFromOutputFields(') + ')');
// eslint-disable-next-line no-eval
const _pubTruncate = eval('(' + extractFn('function _pubTruncate(s, n) {') + ')');
// eslint-disable-next-line no-eval
const _pubToHashtagArray = eval('(' + extractFn('function _pubToHashtagArray(v) {') + ')');
// eslint-disable-next-line no-eval
const _pubPadHashtags = eval('(' + extractFn('function _pubPadHashtags(existing, keywordSources, min, max) {') + ')');
// eslint-disable-next-line no-eval
const _fillPublishingInstagram = eval('(' + extractFn('function _fillPublishingInstagram(base, f) {') + ')');

// ── 実運用 out_1788170314753 の実 fields（Leader Final 由来・P2/caption parser 出力） ──
const REAL_FIELDS = {
  slides: [
    '【1枚目】タイトル：はじめまして、ナチュラルエッセンスです / 本文：自然由来の美容と健康情報を、資料・比較重視でわかりやすお届けします。今回は第1投稿として、A8.netの提携商品「プラファスト」をご紹介します。 / ビジュアル：清潔感のあるナチュラルテイストの表紙。大きく「はじめまして」と「プラファストとは？」を配置し、落ち着いた配色で統一',
    '【2枚目】タイトル：プラファストとは？ / 本文：A8.netで提携中のスキンケア商品です。まずは「どんな商品か」を、公式ページで確認できる入口としてご覧ください。 / ビジュアル：商品名を中心にしたシンプルな情報カード風デザイン。余白を広めに取り、読みやすさを重視',
    '【3枚目】タイトル：まず確認したいポイント / 本文：商品名、カテゴリ、提携状態、公式ページの有無。初回は、基本情報を整理して見るのが安心です。 / ビジュアル：チェックリスト風のレイアウト。アイコンは最小限で、資料感のある見せ方',
    '【4枚目】タイトル：商品事実は公式ページで / 本文：成分・使用感・対象など、商品固有の情報は公式ページで確認してください。 / ビジュアル：公式ページ確認を促す中立的な案内画面',
    '【5枚目】タイトル：安心して見るための見方 / 本文：初めての商品は、いきなり判断せず、公式情報を順番に確認するのがおすすめです。 / ビジュアル：3ステップの流れを図解したミニマルデザイン',
    '【6枚目】タイトル：A8.netの提携商品です / 本文：この投稿は、A8.netの提携情報をもとにご紹介しています。詳細はプロフィールのリンク先でご確認ください。 / ビジュアル：提携情報を伝えるカード',
    '【7枚目】タイトル：こんな見方がしやすいです / 本文：商品ページを見るときは、「何の商品か」「どこで確認できるか」「自分が気になる点は何か」を分けて見ると整理しやすくなります。 / ビジュアル：3分割の整理ボックス',
    '【8枚目】タイトル：保存してあとで見返す / 本文：初回投稿は、あとで見返しやすい形にしておくのが大切です。気になったら保存して、公式ページとあわせて確認してください。 / ビジュアル：保存アイコンを使ったシンプルなリマインド演出',
    '【9枚目】タイトル：フォローで次回もチェック / 本文：ナチュラルエッセンスでは、今後も美容・健康情報を資料感のある形で整理してお届けします。 / ビジュアル：次回予告のような落ち着いた締めカード',
    '【10枚目】タイトル：最後に / 本文：プラファストの詳細は、プロフィールのリンクから公式ページでご確認ください。気になる点があれば、コメントやDMもどうぞ。 / ビジュアル：CTAを中心にした締めの画面',
  ],
  imagePrompts: [
    '清潔感のあるナチュラルテイストのInstagramカルーセル表紙、落ち着いたベージュと白を基調、余白を広く、上品でミニマル、テキスト「はじめまして」「プラファストとは？」を大きく配置、資料感のあるレイアウト、植物の暗示は控えめ、中立的で信頼感のあるデザイン、正方形',
    'シンプルな情報カード風Instagramデザイン、商品名「プラファスト」を中央に配置、A8.net提携商品を整理して見せる見出しスペース、清潔感のある配色、アイコンは最小限、読みやすいタイポグラフィー、正方形',
    'imgprompt-3', 'imgprompt-4', 'imgprompt-5', 'imgprompt-6', 'imgprompt-7', 'imgprompt-8', 'imgprompt-9', 'imgprompt-10',
  ],
  caption: '【広告】A8.netの提携商品「プラファスト」をご紹介します。詳細は公式ページでご確認ください。\n\n#PR',
  cta: 'プロフィールのリンクから公式ページをご確認ください。',
  hashtags: ['#PR', '#ナチュラルエッセンス', '#プラファスト', '#A8net', '#A8ネット', '#スキンケア', '#美容', '#健康', '#美容情報'],
  // targetAudience / benefit は動的 fallback で Leader Final 断片が入り込む（実運用の実値）
  targetAudience: '### Instagram投稿（カルーセル）\n\n【1枚目】タイトル：はじめまして',
  benefit: '### Instagram投稿（カルーセル）\n\n【1枚目】タイトル：はじめまして',
};

// ── 1. _icbSlidesFromOutputFields: fields.slides → Carousel Builder スライド形状 ──
caseHeader('1. _icbSlidesFromOutputFields(): structured fields を正本として採用');
{
  const s = _icbSlidesFromOutputFields(REAL_FIELDS);
  assert(Array.isArray(s) && s.length === 10, `1-1. 10枚を返す（実際: ${s ? s.length : 'null'}）`);
  assert(s[0].headline === 'はじめまして、ナチュラルエッセンスです', '1-2. 1枚目 headline = タイトル部分（Leader Final 正本）');
  assert(s[0].bodyText.indexOf('自然由来の美容と健康情報') === 0, '1-3. 1枚目 bodyText = 本文部分');
  assert(s[0].visualDirection.indexOf('清潔感のあるナチュラルテイストの表紙') === 0, '1-4. 1枚目 visualDirection = ビジュアル部分');
  assert(s[9].headline === '最後に' && s[9].role === 'cta', '1-5. 10枚目 headline=タイトル / role=cta');
  assert(s[0].role === 'hook', '1-6. 1枚目 role=hook');
  assert(s.every((x, i) => x.slideNumber === i + 1 && x.slideId === 'icb-' + (i + 1)), '1-7. slideNumber / slideId が1始まり連番');
  assert(s[0].imagePromptSeed === REAL_FIELDS.imagePrompts[0], '1-8. imagePromptSeed = fields.imagePrompts（正本 Promptをシード化）');
  // Leader Final 非準拠のテンプレ文言が入らない
  const allText = s.map(x => x.headline + ' ' + x.bodyText).join('\n');
  const banned = ['知らないと損する', '9割が見落とす', 'こんな悩み、ありませんか？', 'その原因は？', '解決策① まず基本を押さえる', 'やりがちなNG', 'おすすめ7選', '迷わず選べる決定版'];
  assert(banned.every(w => allText.indexOf(w) === -1), '1-9. テンプレ生成文言（知らないと損する等）が0件');
  // 全 headline / bodyText が fields.slides の部分文字列
  assert(s.every((x, i) => REAL_FIELDS.slides[i].indexOf(x.headline) !== -1), '1-10. 全 headline が fields.slides[i] の部分文字列（生成でなく抽出）');
  assert(s.every((x, i) => !x.bodyText || REAL_FIELDS.slides[i].indexOf(x.bodyText.slice(0, 20)) !== -1), '1-11. 全 bodyText が fields.slides[i] 由来');
  assert(s.every(x => x.role !== 'hook' || x === s[0]) && s.map(x => x.role).join(',') === 'hook,empathy,cause,solution_1,solution_2,solution_3,caution,howto,summary,cta', '1-12. role 列 = funnel 順（scoreInstagramCarouselStructure 互換）');
}

// ── 2. fallback: 構造化 fields がない旧形式 ──
caseHeader('2. fallback: 構造化されていない fields は null（従来テンプレ経路へ）');
{
  assert(_icbSlidesFromOutputFields(null) === null, '2-1. fields null → null');
  assert(_icbSlidesFromOutputFields({}) === null, '2-2. slides なし → null');
  assert(_icbSlidesFromOutputFields({ slides: [] }) === null, '2-3. slides 空配列 → null');
  assert(_icbSlidesFromOutputFields({ slides: ['見出しなしの200字ブロブだけの旧 fallback'] }) === null, '2-4. 単一マーカーなしブロブ（1件） → null');
  assert(_icbSlidesFromOutputFields({ slides: ['A', 'B'] }) === null, '2-5. マーカーなし複数 → null');
  const legacy = _icbSlidesFromOutputFields({ slides: ['Slide 1: こんにちは', 'Slide 2: よろしく', 'Slide 3: まとめ'] });
  assert(Array.isArray(legacy) && legacy.length === 3, '2-6. "Slide N" 形式は構造化として採用（3枚）');
  assert(legacy[0].headline.indexOf('こんにちは') !== -1, '2-7. "Slide N" 形式の本文が headline へ');
}

// ── 3. _fillPublishingInstagram: fields.hashtags 優先・ゴミタグ再生成なし ──
caseHeader('3. _fillPublishingInstagram(): fields 正本を使い、targetAudience/benefit 断片をタグ化しない');
{
  const base = {};
  _fillPublishingInstagram(base, REAL_FIELDS);
  assert(base.description === REAL_FIELDS.caption, '3-1. description = fields.caption（214字・【広告】始まり）');
  assert(base.description.indexOf('### Instagram投稿') === -1, '3-2. description に Leader Final 全文（### 見出し）が入らない');
  assert(base.cta === REAL_FIELDS.cta, '3-3. cta = fields.cta');
  assert(JSON.stringify(base.hashtags) === JSON.stringify(REAL_FIELDS.hashtags), '3-4. hashtags = fields.hashtags（9件・順序保持）');
  assert(base.hashtags.filter(h => h === '#PR').length === 1, '3-5. #PR は1件');
  assert(base.hashtags.length === new Set(base.hashtags).size, '3-6. 全タグが一意');
  assert(base.hashtags.indexOf('###') === -1 && base.hashtags.every(h => !/今回は第1投|です$|^#資料$/.test(h)), '3-7. 【###】【#今回は第1投】等のゴミタグなし');
  assert(base.imageList.length === 10 && base.imageList[0] === REAL_FIELDS.imagePrompts[0], '3-8. imageList = fields.imagePrompts（10件）');
}

// ── 4. fallback: fields.hashtags 空 → 従来の補完ロジック維持 ──
caseHeader('4. _fillPublishingInstagram(): fields.hashtags 空 → 従来の _pubPadHashtags fallback');
{
  const base = {};
  _fillPublishingInstagram(base, { slides: ['a', 'b'], caption: 'c', cta: 'd', hashtags: [], targetAudience: '美容 健康', benefit: '情報発信' });
  assert(base.hashtags.length >= 15, '4-1. hashtags 空 → 従来どおり min15件まで補完（後方互換）');
}

// ── 5. index.html 静的配線確認 ──
caseHeader('5. index.html: Grounded Output Wiring の配線が正しい位置にある');
{
  // 5-1. createInstagramCarouselBuilderDraft 内に grounded slides 分岐
  const icbBody = extractFn('function createInstagramCarouselBuilderDraft(');
  assert(icbBody.indexOf('_icbSlidesFromOutputFields(outputDraft.fields)') !== -1, '5-1. createInstagramCarouselBuilderDraft が _icbSlidesFromOutputFields を呼ぶ');
  assert(icbBody.indexOf("sourceMeta.source = 'outputDraftFields'") !== -1, '5-2. grounded 採用時 sourceMeta.source を outputDraftFields へ');
  assert(icbBody.indexOf('pi.suggestedHashtags = outputDraft.fields.hashtags') !== -1, '5-3. grounded 時 pi.suggestedHashtags も fields を優先（下流伝播）');
  assert(icbBody.indexOf('pi.suggestedCTA = String(outputDraft.fields.cta).trim()') !== -1, '5-4. grounded 時 pi.suggestedCTA も fields を優先');
  // 5-5. buildInstagramCarouselSlides() は残っている（fallback）
  assert(icbBody.indexOf('var slides = buildInstagramCarouselSlides(pi);') !== -1, '5-5. テンプレ生成 buildInstagramCarouselSlides(pi) は fallback として残置');
  // 5-6. buildOutputDraftFromLeaderFinal で派生キャッシュを無効化
  const bodfBody = extractFn('function buildOutputDraftFromLeaderFinal(');
  assert(bodfBody.indexOf("['publishing', 'instagramContentPlanning', 'instagramCarouselBuilder', 'instagramDesignSystem', 'mobileReviewCenter']") !== -1,
    '5-6. buildOutputDraftFromLeaderFinal が fields 再構築時に派生キャッシュを null 化');
  // 5-7. キャッシュ無効化は candidateOnly 早期 return より前（candidate にも適用）
  const clearIdx = bodfBody.indexOf("['publishing', 'instagramContentPlanning'");
  const candIdx = bodfBody.indexOf('opts.candidateOnly === true');
  assert(clearIdx !== -1 && candIdx !== -1 && clearIdx < candIdx, '5-7. キャッシュ無効化は candidateOnly return より前（draft 対象）');
  // 5-8. INSTAGRAM_CAROUSEL の caption/slides/hashtags 修正（前回）は不変
  assert(src.indexOf('if (_lfSec.caption != null && String(_lfSec.caption).trim()) {') !== -1, '5-8. caption wiring（前回）が不変');
}

// ── 6. 新しい商品事実を生成しない ──
caseHeader('6. _icbSlidesFromOutputFields は抽出のみ（新規文字列を生成しない）');
{
  const s = _icbSlidesFromOutputFields(REAL_FIELDS);
  const joined = REAL_FIELDS.slides.join('\n');
  const banned = ['天然成分', '背に優しい', '保湿効果', '安全性', 'キャンペーン', '効果的', '9割'];
  const allText = s.map(x => x.headline + ' ' + x.bodyText + ' ' + x.visualDirection).join('\n');
  assert(banned.every(w => allText.indexOf(w) === -1), '6-1. 未確認商品事実語・誤導統計が0件');
  assert(s.every(x => !x.headline || joined.indexOf(x.headline) !== -1), '6-2. headline はすべて fields.slides の部分文字列');
}

console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
console.log(_failed === 0 ? '🟢 All Mobile Review Grounded Output Wiring cases passed' : '🔴 FAILED');
process.exitCode = _failed === 0 ? 0 : 1;
