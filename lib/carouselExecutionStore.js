'use strict';
// lib/carouselExecutionStore.js
// Carousel Image Production — Phase 2-E Production Connection Step B: executionStore adapter。
//
//   責務: lib/carouselExecutionDb.js の reserve/complete/fail/累積取得を1つの薄いオブジェクトへ
//   束ねるだけの server-side adapter。DB-specific なロジック（Supabase呼び出し・23505分類・
//   status別集計規則）は一切ここへ持ち込まない——それらは lib/carouselExecutionDb.js の責務。
//
//   ★ shared/carouselImageCore.js（DB I/O 非責務・carouselApproval.js と同じ境界）からは
//     本ファイルを直接 require しない。runCarouselImageJob() へは
//     { reserve, complete, fail } の3関数だけを deps.executionStore として注入する
//     （呼び出し側＝将来の server route の責務）。
//   ★ getCumulativeSpentJpyByOutputId は runCarouselImageJob() の deps.executionStore
//     インターフェースには含まれない（shared coreは累積予算の存在を知らない設計を維持する）。
//     per-post cumulative budget の判定は呼び出し側（route）の責務。
//
//   Decision 110（Server-only Trust Boundary）を維持: 本ファイルは lib/carouselExecutionDb.js
//   経由でのみ privileged client（lib/carouselExecutionSupabase.js）へ触れ、anon client
//   （lib/supabase.js）は一切参照しない。secret値の取得・ログ出力は行わない。

const db = require('./carouselExecutionDb');

// runCarouselImageJob() の deps.executionStore にそのまま渡せる形（reserve/complete/fail のみ）。
const carouselExecutionStore = {
  reserve: function (payload) { return db.reserveExecution(payload); },
  complete: function (payload) { return db.completeExecution(payload); },
  fail: function (payload) { return db.failExecution(payload); },
  // per-post cumulative budget の取得。deps.executionStore とは別に、route側が
  // reserve 呼び出し前後の judgement に使う（shared core は関知しない）。
  getCumulativeSpentJpyByOutputId: function (outputId) { return db.getCumulativeSpentJpyByOutputId(outputId); },
};

module.exports = {
  carouselExecutionStore: carouselExecutionStore,
};
