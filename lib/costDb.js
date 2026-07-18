// ══════════════════════════════════════════════════════════════
// 工程A-2-4: 料金DBアクセス層（lib/costDb.js）
// 目的: A-2-3で作成した Supabase 料金基盤（api_cost_events / api_cost_settings /
//   api_cost_opening_balance / api_cost_daily_v）への安全なアクセス層。
//   Supabase を料金情報の恒久正本とし、A-2-5/A-2-6 の書き込み配線の土台とする。
// 責務: DBアクセスと標準集計構造まで。既存 costTracker.getSummary() 互換の生成は A-2-7 で行う（本層では作らない）。
// 接続: 既存 lib/supabase.js の ANON キー（他モジュールと同一）。
// 方針: DB失敗を 0円・正常状態として断定しない。秘匿情報（URL/KEY）は error/log に含めない。
//   実DBへの INSERT/UPDATE/DELETE は本工程では実行しない（配線は A-2-5 以降）。
// ══════════════════════════════════════════════════════════════
const { supabase } = require('./supabase');

// ── 共通戻り値ヘルパ ─────────────────────────────
function _ok(data, { source = 'db', stale = false } = {}) {
  return { ok: true, data, source, stale, error: null };
}
function _fail(message, code, { source = 'db', stale = true } = {}) {
  // 秘匿情報を載せないため message/code のみ（Supabase URL/KEY は含めない）
  return { ok: false, data: null, source, stale, error: { message: String(message || 'error'), code: code || null } };
}

// ── JST日付ロジック（A-2-2 と同一方式・外部ライブラリ不使用） ──
function _jstNow()      { return new Date(Date.now() + 9 * 60 * 60 * 1000); }
function _jstTodayKey() { return _jstNow().toISOString().slice(0, 10); } // YYYY-MM-DD
function _jstMonthKey() { return _jstNow().toISOString().slice(0, 7);  } // YYYY-MM

// ── 集計の 0 構造 ─────────────────────────────
function _zeroMetrics() {
  return { requests: 0, input_tokens: 0, output_tokens: 0, amount_jpy: 0, amount_usd: 0 };
}
function _zeroByProvider() {
  return { openai: _zeroMetrics(), claude: _zeroMetrics() };
}
function _num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// 集計行（api_cost_daily_v 由来）を total + by_provider へ畳み込む。イベントは行単位でユニークなため二重計上なし。
function _foldRows(rows) {
  const total = _zeroMetrics();
  const byProvider = _zeroByProvider();
  (rows || []).forEach(function (r) {
    const p = (r.provider === 'openai' || r.provider === 'claude') ? r.provider : null;
    const m = { requests: _num(r.requests), input_tokens: _num(r.input_tokens), output_tokens: _num(r.output_tokens), amount_jpy: _num(r.amount_jpy), amount_usd: _num(r.amount_usd) };
    total.requests += m.requests; total.input_tokens += m.input_tokens; total.output_tokens += m.output_tokens;
    total.amount_jpy += m.amount_jpy; total.amount_usd += m.amount_usd;
    if (p) {
      byProvider[p].requests += m.requests; byProvider[p].input_tokens += m.input_tokens; byProvider[p].output_tokens += m.output_tokens;
      byProvider[p].amount_jpy += m.amount_jpy; byProvider[p].amount_usd += m.amount_usd;
    }
  });
  return { total, by_provider: byProvider };
}

// ── hydration 状態（モジュール内・実行中キャッシュ） ──
let _costState = {
  status: 'idle',      // idle | hydrating | ready | stale | error
  hydrated: false,
  stale: true,
  started_at: null,
  completed_at: null,
  error: null,
  data: null,
};
let _hydrateInFlight = null; // 同時呼び出しの重複実行防止（同一 Promise を返す）

function _safeClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return null; }
}

// ══════════════════════════════════════════════════════════════
// 3. insertCostEvent(event)
//   usage_event_id の UNIQUE 制約で冪等。同一IDの再送は二重加算せず「安全な成功（duplicate）」で返す。
//   一意制約以外（通信/DB/権限）は成功扱いしない。既存イベントを上書きして金額を変えない。
// ══════════════════════════════════════════════════════════════
async function insertCostEvent(event) {
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });
  const e = event || {};

  // 必須
  if (!e.usage_event_id || String(e.usage_event_id).trim() === '') return _fail('usage_event_id は必須です', 'validation');
  if (!e.usage_date) return _fail('usage_date は必須です', 'validation');
  if (!e.provider)   return _fail('provider は必須です', 'validation');

  // 検証
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.usage_date))) return _fail('usage_date は YYYY-MM-DD 形式です', 'validation');
  if (e.provider !== 'openai' && e.provider !== 'claude') return _fail('provider は openai / claude のみ', 'validation');

  // 既定値
  const row = {
    usage_event_id: String(e.usage_event_id),
    usage_date:     String(e.usage_date),
    provider:       e.provider,
    model:          e.model || 'unknown',
    assignee:       e.assignee || 'web',
    usage_type:     e.usage_type || 'text',
    requests:       (e.requests      == null) ? 1 : _num(e.requests),
    input_tokens:   (e.input_tokens  == null) ? 0 : _num(e.input_tokens),
    output_tokens:  (e.output_tokens == null) ? 0 : _num(e.output_tokens),
    amount_jpy:     (e.amount_jpy    == null) ? 0 : _num(e.amount_jpy),
    amount_usd:     (e.amount_usd    == null) ? 0 : _num(e.amount_usd),
    currency:       e.currency || 'JPY',
  };
  // 任意（為替情報）
  if (e.exchange_rate != null)             row.exchange_rate = _num(e.exchange_rate);
  if (e.exchange_rate_source)              row.exchange_rate_source = String(e.exchange_rate_source);
  if (e.exchange_rate_recorded_at)         row.exchange_rate_recorded_at = e.exchange_rate_recorded_at;
  if (e.exchange_rate_version)             row.exchange_rate_version = String(e.exchange_rate_version);

  // 非負検証
  if (row.requests < 0 || row.input_tokens < 0 || row.output_tokens < 0 || row.amount_jpy < 0 || row.amount_usd < 0) {
    return _fail('requests / token / 金額は 0 以上です', 'validation');
  }

  try {
    const { data, error } = await supabase.from('api_cost_events').insert(row).select().single();
    if (error) {
      // 一意制約違反（Postgres 23505）＝同一 usage_event_id の再送 → 二重加算せず安全な成功
      if (error.code === '23505' || /duplicate key|unique/i.test(error.message || '')) {
        return _ok({ inserted: false, duplicate: true, usage_event_id: row.usage_event_id });
      }
      // それ以外（通信/DB/権限）は成功扱いにしない
      return _fail(error.message, error.code);
    }
    return _ok({ inserted: true, duplicate: false, event: data });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// 4. getCostSettings() : api_cost_settings id=1
//   行がない場合は DB へ INSERT せず fallback を返す（source:'fallback', stale:true）。
//   DB接続失敗は 0円・正常と断定せず ok:false。
// ══════════════════════════════════════════════════════════════
async function getCostSettings() {
  const fallback = { id: 1, monthly_limit: 1000, stopped: false, updated_at: null };
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });
  try {
    const { data, error } = await supabase.from('api_cost_settings').select('*').eq('id', 1).maybeSingle();
    if (error) return _fail(error.message, error.code);
    if (!data) return _ok(fallback, { source: 'fallback', stale: true }); // 行なし＝勝手にINSERTしない
    return _ok({ id: data.id, monthly_limit: _num(data.monthly_limit), stopped: !!data.stopped, updated_at: data.updated_at });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// 5. updateCostSettings(patch) : id=1 固定・監査時刻更新
//   ※本工程では実DBへのUPDATEテストは行わない（配線・検証は後続）。
// ══════════════════════════════════════════════════════════════
async function updateCostSettings(patch) {
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });
  const p = patch || {};
  const hasLimit   = (p.monthly_limit !== undefined);
  const hasStopped = (p.stopped !== undefined);
  if (!hasLimit && !hasStopped) return _fail('空の patch は許可されません', 'validation');
  if (hasLimit && (_num(p.monthly_limit) < 0)) return _fail('monthly_limit は 0 以上です', 'validation');
  if (hasStopped && typeof p.stopped !== 'boolean') return _fail('stopped は boolean です', 'validation');

  const upd = { id: 1, updated_at: new Date().toISOString() };
  if (hasLimit)   upd.monthly_limit = _num(p.monthly_limit);
  if (hasStopped) upd.stopped = p.stopped;

  try {
    // id=1 固定で upsert（id=1 以外は作らない）
    const { data, error } = await supabase.from('api_cost_settings').upsert(upd, { onConflict: 'id' }).select().single();
    if (error) return _fail(error.message, error.code);
    return _ok({ id: data.id, monthly_limit: _num(data.monthly_limit), stopped: !!data.stopped, updated_at: data.updated_at });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// 6. getDailyCostSummary({ usageDate, provider })
//   provider 省略時は全provider合計。0行でも 0 構造を返す。
// ══════════════════════════════════════════════════════════════
async function getDailyCostSummary(options) {
  const o = options || {};
  if (!o.usageDate) return _fail('usageDate は必須です', 'validation');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(o.usageDate))) return _fail('usageDate は YYYY-MM-DD 形式です', 'validation');
  if (o.provider && o.provider !== 'openai' && o.provider !== 'claude') return _fail('provider は openai / claude のみ', 'validation');
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });
  try {
    let q = supabase.from('api_cost_daily_v').select('*').eq('usage_date', o.usageDate);
    if (o.provider) q = q.eq('provider', o.provider);
    const { data, error } = await q;
    if (error) return _fail(error.message, error.code);
    const folded = _foldRows(data);
    return _ok({ usage_date: o.usageDate, total: folded.total, by_provider: folded.by_provider });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// 7. getMonthlyCostSummary({ month })
//   JST基準: month-01 以上 〜 翌月-01 未満。opening balance は含めない。
// ══════════════════════════════════════════════════════════════
function _monthRange(month) {
  // month = 'YYYY-MM' → [start='YYYY-MM-01', end=翌月'YYYY-MM-01')
  const m = /^(\d{4})-(\d{2})$/.exec(String(month));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  const start = m[1] + '-' + m[2] + '-01';
  const ny = (mo === 12) ? y + 1 : y;
  const nmo = (mo === 12) ? 1 : mo + 1;
  const end = String(ny) + '-' + String(nmo).padStart(2, '0') + '-01';
  return { start, end };
}
async function getMonthlyCostSummary(options) {
  const o = options || {};
  const range = _monthRange(o.month);
  if (!range) return _fail('month は YYYY-MM 形式です', 'validation');
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });
  try {
    // api_cost_daily_v を日付範囲で集計（イベントは行単位ユニーク＝二重計上なし）
    const { data, error } = await supabase.from('api_cost_daily_v').select('*')
      .gte('usage_date', range.start).lt('usage_date', range.end);
    if (error) return _fail(error.message, error.code);
    const folded = _foldRows(data);
    return _ok({ month: o.month, total: folded.total, by_provider: folded.by_provider });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// 8. getOpeningBalance() : is_active=true のみ
//   provider=unknown を OpenAI/Claude へ配分しない。
// ══════════════════════════════════════════════════════════════
async function getOpeningBalance() {
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });
  try {
    const { data, error } = await supabase.from('api_cost_opening_balance').select('*').eq('is_active', true);
    if (error) return _fail(error.message, error.code);
    const rows = data || [];
    const amount = rows.reduce(function (s, r) { return s + _num(r.amount_jpy); }, 0);
    const entries = rows.map(function (r) {
      return {
        id: r.id, balance_type: r.balance_type, provider: r.provider, amount_jpy: _num(r.amount_jpy),
        source: r.source, is_verified: !!r.is_verified, is_active: !!r.is_active, migrated_at: r.migrated_at, note: r.note,
      };
    });
    return _ok({ amount_jpy: amount, count: rows.length, entries: entries });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// 9. getCumulativeCostSummary() : events累計 と opening balance を分離
//   grand_total.amount_jpy = events.amount_jpy + opening_balance.amount_jpy
//   opening balance は requests/token/amount_usd に加えない。
// ══════════════════════════════════════════════════════════════
async function getCumulativeCostSummary() {
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });
  try {
    const { data, error } = await supabase.from('api_cost_daily_v').select('*'); // 全期間
    if (error) return _fail(error.message, error.code);
    const folded = _foldRows(data);
    const ob = await getOpeningBalance();
    if (!ob.ok) return _fail(ob.error && ob.error.message, ob.error && ob.error.code);
    const events = {
      requests: folded.total.requests, input_tokens: folded.total.input_tokens, output_tokens: folded.total.output_tokens,
      amount_jpy: folded.total.amount_jpy, amount_usd: folded.total.amount_usd, by_provider: folded.by_provider,
    };
    const opening_balance = { amount_jpy: ob.data.amount_jpy, count: ob.data.count };
    return _ok({
      events: events,
      opening_balance: opening_balance,
      grand_total: { amount_jpy: events.amount_jpy + opening_balance.amount_jpy },
    });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// 10. hydrateCostState() : settings/当日/当月/累計/opening を DB から取得
//   同時呼び出しは同一 Promise を返し重複実行しない。DB失敗を 0円・正常にしない。
// ══════════════════════════════════════════════════════════════
async function hydrateCostState() {
  if (_hydrateInFlight) return _hydrateInFlight;   // 進行中なら同一 Promise を返す
  _costState.status = 'hydrating';
  _costState.started_at = new Date().toISOString();
  _costState.error = null;

  _hydrateInFlight = (async function () {
    try {
      const today = _jstTodayKey();
      const month = _jstMonthKey();
      const [settings, daily, monthly, cumulative, opening] = await Promise.all([
        getCostSettings(),
        getDailyCostSummary({ usageDate: today }),
        getMonthlyCostSummary({ month: month }),
        getCumulativeCostSummary(),
        getOpeningBalance(),
      ]);

      // DB接続失敗（ok:false）は全体を正常扱いにしない。どの項目が失敗したか明示。
      const failed = [];
      if (!settings.ok)   failed.push('settings');
      if (!daily.ok)      failed.push('daily');
      if (!monthly.ok)    failed.push('monthly');
      if (!cumulative.ok) failed.push('cumulative');
      if (!opening.ok)    failed.push('opening_balance');

      if (failed.length > 0) {
        _costState = {
          status: 'error', hydrated: false, stale: true,
          started_at: _costState.started_at, completed_at: new Date().toISOString(),
          error: { message: 'hydrate 一部失敗: ' + failed.join(','), code: 'partial_failure', failed: failed },
          data: null,
        };
        return _safeClone(_costState);
      }

      // settings が fallback（DB行なし）の場合は stale として扱う（0円・正常と断定しない趣旨に沿う）
      const isStale = (settings.source === 'fallback');
      _costState = {
        status: isStale ? 'stale' : 'ready',
        hydrated: true,
        stale: isStale,
        started_at: _costState.started_at,
        completed_at: new Date().toISOString(),
        error: null,
        data: {
          settings: settings.data,
          daily: daily.data,
          monthly: monthly.data,
          cumulative: cumulative.data,
          opening_balance: opening.data,
        },
      };
      return _safeClone(_costState);
    } catch (ex) {
      _costState = {
        status: 'error', hydrated: false, stale: true,
        started_at: _costState.started_at, completed_at: new Date().toISOString(),
        error: { message: String(ex && ex.message || 'hydrate exception'), code: 'exception' },
        data: null,
      };
      return _safeClone(_costState);
    } finally {
      _hydrateInFlight = null;   // 完了後にロック解除（次回の再hydrateを許可）
    }
  })();

  return _hydrateInFlight;
}

// ══════════════════════════════════════════════════════════════
// 11. getCostHydrationState() : 現在の hydration 状態（安全なコピー）
// ══════════════════════════════════════════════════════════════
function getCostHydrationState() {
  return _safeClone(_costState);
}

// ══════════════════════════════════════════════════════════════
// 12. markCostStateStale() : 保存/更新後にキャッシュを stale 化
// ══════════════════════════════════════════════════════════════
function markCostStateStale() {
  _costState.status = 'stale';
  _costState.stale = true;
  return _safeClone(_costState);
}

// ══════════════════════════════════════════════════════════════
// A-2-7: Legacy Cost Summary Compatibility Layer
//   既存 costTracker.getSummary() 互換の集計構造を Supabase 料金正本から生成する読み取り層。
//   provider 既定は 'openai'（既存 /api/cost が OpenAI 対象。openai+claude 自動合算はしない）。
//   'claude' / 'all' は明示指定時のみ。'all' は本工程では /api/cost・UI へ接続しない。
//   生成のみ（/api/cost・UI・月額停止ゲートの実切替は行わない）。
//   DB失敗を 0円・正常と偽装しない（_fail を返す）。互換 summary 本体（data）へ stale/error を混入しない
//     （stale は costDb 標準 envelope 側で表現）。opening balance は含めない（既存 getSummary が持たないため）。
// ══════════════════════════════════════════════════════════════
// 既存 costTracker.js DEFAULT_STATE を正本とする互換既定キー（UI互換のため未使用でも 0 で存在させる）
const _LEGACY_DEFAULT_ASSIGNEES = ['web', 'snsVideo', 'aiDevelopment', 'estimate'];
const _LEGACY_DEFAULT_TYPES     = ['text', 'image', 'video', 'analysis'];
const _LEGACY_DEFAULT_MODELS    = ['gpt-4.1-mini', 'gpt-4.1-nano'];

function _seedMap(keys) { const o = {}; keys.forEach(function (k) { o[k] = 0; }); return o; }
function _round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

async function buildLegacyCostSummaryFromDb(options) {
  const o = options || {};
  const provider = (o.provider == null) ? 'openai' : o.provider; // 既定は OpenAI 限定
  if (provider !== 'openai' && provider !== 'claude' && provider !== 'all') {
    return _fail("provider は 'openai' / 'claude' / 'all' のみ", 'validation');
  }
  if (!supabase) return _fail('Supabase未設定', 'no_client', { source: 'fallback' });

  const today = o.usageDate || _jstTodayKey();
  const month = o.month || _jstMonthKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today))) return _fail('usageDate は YYYY-MM-DD 形式です', 'validation');
  if (!/^\d{4}-\d{2}$/.test(String(month)))       return _fail('month は YYYY-MM 形式です', 'validation');

  try {
    const provFilter = (provider === 'all') ? null : provider; // 'all' は無フィルタ

    // 当日（provider 反映）・当月・累計・設定
    const [daily, monthly, cumulative, settings] = await Promise.all([
      getDailyCostSummary(provFilter ? { usageDate: today, provider: provFilter } : { usageDate: today }),
      getMonthlyCostSummary({ month: month }),
      getCumulativeCostSummary(),
      getCostSettings(),
    ]);

    // DB失敗（ok:false）は 0円・正常と断定しない。settings は行なし fallback を _ok で返すため別扱い。
    const failed = [];
    if (!daily.ok)      failed.push('daily');
    if (!monthly.ok)    failed.push('monthly');
    if (!cumulative.ok) failed.push('cumulative');
    if (!settings.ok)   failed.push('settings');
    if (failed.length > 0) return _fail('legacy summary 一部失敗: ' + failed.join(','), 'partial_failure');

    // provider スコープの金額（当日は daily 側で provider 反映済み＝total を使用）
    const todayAmount   = _round2(daily.data.total.amount_jpy);
    const monthlyAmount = _round2(provider === 'all'
      ? monthly.data.total.amount_jpy
      : monthly.data.by_provider[provider].amount_jpy);
    // totalAmount は events 累計のみ（opening balance は含めない＝既存 getSummary と同義）
    const totalAmount   = _round2(provider === 'all'
      ? cumulative.data.events.amount_jpy
      : cumulative.data.events.by_provider[provider].amount_jpy);

    // breakdown（assignee / type / model 別・累計）: 集計View に無いため api_cost_events を直読
    let evq = supabase.from('api_cost_events').select('assignee,usage_type,model,amount_jpy');
    if (provFilter) evq = evq.eq('provider', provFilter);
    const { data: evRows, error: evErr } = await evq;
    if (evErr) return _fail(evErr.message, evErr.code);

    const byAssignee = _seedMap(_LEGACY_DEFAULT_ASSIGNEES);
    const byType     = _seedMap(_LEGACY_DEFAULT_TYPES);
    const modelCosts = _seedMap(_LEGACY_DEFAULT_MODELS);
    (evRows || []).forEach(function (r) {
      const a = r.assignee || 'unknown';
      const t = r.usage_type || 'text';
      const m = r.model || 'unknown';
      const amt = _num(r.amount_jpy);
      byAssignee[a] = _round2((byAssignee[a] || 0) + amt);
      byType[t]     = _round2((byType[t]     || 0) + amt);
      modelCosts[m] = _round2((modelCosts[m] || 0) + amt);
    });

    const monthlyLimit = _num(settings.data.monthly_limit);
    const stopped      = !!settings.data.stopped; // 停止ゲート正本は settings（判定ロジックは追加しない）
    const remaining    = _round2(Math.max(monthlyLimit - monthlyAmount, 0));

    // 既存 getSummary() 互換の本体（stale/error などの新キーは混入しない）
    const summary = {
      todayAmount: todayAmount,
      monthlyAmount: monthlyAmount,
      totalAmount: totalAmount,
      todayKey: today,
      monthKey: month,
      monthlyLimit: monthlyLimit,
      remaining: remaining,
      byAssignee: byAssignee,
      byType: byType,
      agentCosts: Object.assign({}, byAssignee),       // 既存: agentCosts = byAssignee 同値
      departmentCosts: Object.assign({}, byAssignee),  // 既存: departmentCosts = byAssignee 同値
      breakdown: { byAssignee: Object.assign({}, byAssignee), byType: Object.assign({}, byType) },
      modelCosts: modelCosts,
      stopped: stopped,
    };

    // settings が fallback（DB行なし）の場合は stale（本体は汚さず envelope 側で表現）
    const stale = (settings.source === 'fallback');
    return _ok(summary, { stale: stale });
  } catch (ex) {
    return _fail(ex && ex.message, 'exception');
  }
}

// ══════════════════════════════════════════════════════════════
// A-2-8a: /api/cost 表示切替用ラッパー
//   provider 別に「最後の正常 Legacy Summary」を保持し、DB障害時は last-good を返す。
//   0円Summaryの捏造・costTracker への fallback はしない。cold start（last-good なし）は ok:false。
//   summary 本体（data）には stale/error/source を混入しない（既存14キー互換を壊さない）。
//   ※ 表示専用。月額停止ゲート（costTracker.canProcess()/getSummary().stopped）はここでは扱わない。
// ══════════════════════════════════════════════════════════════
const _legacyLastGood = { openai: null, claude: null, all: null }; // provider別に分離保持

async function getLegacyCostSummaryForApi(options) {
  const o = options || {};
  const provider = (o.provider == null) ? 'openai' : o.provider;
  if (provider !== 'openai' && provider !== 'claude' && provider !== 'all') {
    return { ok: false, invalidProvider: true, data: null, servedFrom: null };
  }
  const res = await buildLegacyCostSummaryFromDb({ provider: provider });
  if (res.ok) {
    _legacyLastGood[provider] = res.data;                 // provider別 last-good を更新
    return { ok: true, data: res.data, servedFrom: 'live' };
  }
  if (_legacyLastGood[provider]) {
    return { ok: true, data: _legacyLastGood[provider], servedFrom: 'cache' }; // 直前の正常値を維持
  }
  return { ok: false, coldStart: true, data: null, servedFrom: null }; // 一度も正常取得なし
}

module.exports = {
  insertCostEvent,
  buildLegacyCostSummaryFromDb, // A-2-7: getSummary 互換構造のDB生成（生成のみ・実切替なし）
  getLegacyCostSummaryForApi,   // A-2-8a: /api/cost 表示用（provider別last-good・DB障害安全）
  getCostSettings,
  updateCostSettings,
  getDailyCostSummary,
  getMonthlyCostSummary,
  getOpeningBalance,
  getCumulativeCostSummary,
  hydrateCostState,
  getCostHydrationState,
  markCostStateStale,
};
