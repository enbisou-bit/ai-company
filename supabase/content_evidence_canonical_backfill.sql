-- ══════════════════════════════════════════════════════════════
-- supabase/content_evidence_canonical_backfill.sql
-- Safety Foundation B1: legacy fields.contentEvidence / fields.contentClaims → canonical 列 backfill
--
--   ★★ 本番実行はユーザーの明示承認後のみ。各 STEP を上から順に「単独で」実行し、結果を確認してから次へ進む。
--   ★ 前提: supabase/schema.sql の「Safety Foundation B1 Migration」ALTER 3行が適用済みであること（STEP 0 で確認）。
--   ★ legacy fields は削除・変更しない（rollback / 監査の source として残す）。
--   ★ canonical 3列がすべて NULL の row だけを対象にする（既に canonical を持つ row は上書きしない）。
--   ★ Evidence / Claims 双方が有効な非空配列で、record の caseId が row の case_id と一致する row だけを対象にする。
--
--   第一投稿の期待値:
--     case_id   = 'case-value-1788410623'
--     output_id = 'out_1788413020275'
--     contentEvidence = 6件（verified 6件） / contentClaims = 3件（CI-01 / CI-02 / CI-03・grounded）
-- ══════════════════════════════════════════════════════════════


-- ── STEP 0: 列の存在確認（読み取りのみ）── 期待: 3行・data_type=jsonb・is_nullable=YES
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'output_drafts'
  AND column_name IN ('content_evidence', 'content_claims', 'content_evidence_origin')
ORDER BY column_name;


-- ── STEP 1: 事前SELECT（backfill 対象候補の確認・読み取りのみ）──
--   eligible=true の row だけが STEP 2 で更新される。期待: 第一投稿 1行が eligible=true（6 / 3）。
SELECT
  d.output_id,
  d.case_id,
  d.updated_at,
  CASE WHEN jsonb_typeof(d.fields->'contentEvidence') = 'array' THEN jsonb_array_length(d.fields->'contentEvidence') END AS legacy_evidence,
  CASE WHEN jsonb_typeof(d.fields->'contentClaims')   = 'array' THEN jsonb_array_length(d.fields->'contentClaims')   END AS legacy_claims,
  (d.content_evidence IS NULL AND d.content_claims IS NULL AND d.content_evidence_origin IS NULL) AS canonical_empty,
  (
    d.content_evidence IS NULL AND d.content_claims IS NULL AND d.content_evidence_origin IS NULL
    AND jsonb_typeof(d.fields->'contentEvidence') = 'array' AND jsonb_array_length(d.fields->'contentEvidence') > 0
    AND jsonb_typeof(d.fields->'contentClaims')   = 'array' AND jsonb_array_length(d.fields->'contentClaims')   > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(d.fields->'contentEvidence') e
      WHERE jsonb_typeof(e) <> 'object' OR (e->>'caseId') IS DISTINCT FROM d.case_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(d.fields->'contentClaims') c
      WHERE jsonb_typeof(c) <> 'object' OR COALESCE(c->>'claimId', '') = '' OR (c->>'status') IS DISTINCT FROM 'grounded'
    )
  ) AS eligible
FROM output_drafts d
WHERE jsonb_typeof(d.fields->'contentEvidence') = 'array'
   OR jsonb_typeof(d.fields->'contentClaims') = 'array'
ORDER BY d.updated_at DESC;


-- ── STEP 2: backfill（★書き込み。明示承認後のみ）──
--   BEGIN → UPDATE ... RETURNING で対象を目視確認 → 期待どおりなら COMMIT、想定外なら ROLLBACK。
--   ★ ファイル全体を誤って一括実行しても書き込まれないよう、ブロックコメントで無効化してある。
--     実行時は /* と */ の内側だけを選択して実行すること。
/*
BEGIN;

UPDATE output_drafts d
SET
  content_evidence = d.fields->'contentEvidence',
  content_claims   = d.fields->'contentClaims',
  content_evidence_origin = jsonb_build_object(
    'mode',          'legacy_fields_backfill',
    'version',       '1.0.0',
    'caseId',        d.case_id,
    'outputId',      d.output_id,
    'backfilledAt',  to_jsonb(NOW()),
    'recordedAt',    (
      SELECT CASE WHEN COUNT(DISTINCT e->>'recordedAt') = 1 THEN MAX(e->>'recordedAt') END
      FROM jsonb_array_elements(d.fields->'contentEvidence') e
    ),
    'evidenceCount', jsonb_array_length(d.fields->'contentEvidence'),
    'claimsCount',   jsonb_array_length(d.fields->'contentClaims')
  )
WHERE d.content_evidence IS NULL AND d.content_claims IS NULL AND d.content_evidence_origin IS NULL
  AND jsonb_typeof(d.fields->'contentEvidence') = 'array' AND jsonb_array_length(d.fields->'contentEvidence') > 0
  AND jsonb_typeof(d.fields->'contentClaims')   = 'array' AND jsonb_array_length(d.fields->'contentClaims')   > 0
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(d.fields->'contentEvidence') e
    WHERE jsonb_typeof(e) <> 'object' OR (e->>'caseId') IS DISTINCT FROM d.case_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(d.fields->'contentClaims') c
    WHERE jsonb_typeof(c) <> 'object' OR COALESCE(c->>'claimId', '') = '' OR (c->>'status') IS DISTINCT FROM 'grounded'
  )
RETURNING d.output_id, d.case_id,
  jsonb_array_length(d.content_evidence) AS canonical_evidence,
  jsonb_array_length(d.content_claims)   AS canonical_claims;

-- RETURNING が STEP 1 の eligible=true の row と一致することを確認してから、どちらか一方だけを実行する:
-- COMMIT;
-- ROLLBACK;
*/


-- ── STEP 3: 第一投稿の事後確認（読み取りのみ）──
--   期待: evidence=6 / claims=3 / verified=6 / origin_mode=legacy_fields_backfill /
--         evidence_matches_legacy=true / claims_matches_legacy=true / claim_ids=CI-01,CI-02,CI-03
SELECT
  d.output_id,
  d.case_id,
  jsonb_array_length(d.content_evidence) AS evidence,
  jsonb_array_length(d.content_claims)   AS claims,
  (SELECT COUNT(*) FROM jsonb_array_elements(d.content_evidence) e WHERE e->>'verificationStatus' = 'verified') AS verified,
  d.content_evidence_origin->>'mode' AS origin_mode,
  (d.content_evidence = d.fields->'contentEvidence') AS evidence_matches_legacy,
  (d.content_claims   = d.fields->'contentClaims')   AS claims_matches_legacy,
  (SELECT string_agg(c->>'claimId', ',' ORDER BY c->>'claimId') FROM jsonb_array_elements(d.content_claims) c) AS claim_ids
FROM output_drafts d
WHERE d.case_id = 'case-value-1788410623' AND d.output_id = 'out_1788413020275';


-- ══════════════════════════════════════════════════════════════
-- ROLLBACK 手順（★必要時のみ・明示承認後のみ）
-- ══════════════════════════════════════════════════════════════

-- R1: backfill のデータ rollback（backfill で設定した canonical 列だけを NULL へ戻す）。
--   ★ legacy fields が backfill 時点と同一のまま残っている row に限定する
--     （B1 コードは通常保存で legacy fields を引き継ぐため、通常は同一のまま残る）。
--   ★ Evidence Resolution（mode='resolution'）で確定した canonical は対象外。
-- BEGIN;
-- UPDATE output_drafts d
-- SET content_evidence = NULL, content_claims = NULL, content_evidence_origin = NULL
-- WHERE d.content_evidence_origin->>'mode' = 'legacy_fields_backfill'
--   AND d.content_evidence = d.fields->'contentEvidence'
--   AND d.content_claims   = d.fields->'contentClaims'
-- RETURNING d.output_id, d.case_id;
-- COMMIT;  -- または ROLLBACK;

-- R2: B1 以前のコードへ戻す場合の legacy fields 復元（canonical 列 → fields）。
--   ★ B1 コード稼働中に Evidence Resolution で確定した row は legacy fields を持たないため、
--     旧コード（fields を正本とする実装）へ戻す前にのみ実行する。canonical 列は変更しない。
-- BEGIN;
-- UPDATE output_drafts d
-- SET fields = jsonb_set(jsonb_set(COALESCE(d.fields, '{}'::jsonb), '{contentEvidence}', d.content_evidence), '{contentClaims}', d.content_claims)
-- WHERE jsonb_typeof(d.content_evidence) = 'array' AND jsonb_typeof(d.content_claims) = 'array'
--   AND (d.fields->'contentEvidence' IS DISTINCT FROM d.content_evidence OR d.fields->'contentClaims' IS DISTINCT FROM d.content_claims)
-- RETURNING d.output_id, d.case_id;
-- COMMIT;  -- または ROLLBACK;

-- R3: 列そのものの削除（★破壊的・最終手段。R2 実行と fields 側の内容確認が完了してからのみ）。
-- ALTER TABLE output_drafts DROP COLUMN IF EXISTS content_evidence_origin;
-- ALTER TABLE output_drafts DROP COLUMN IF EXISTS content_claims;
-- ALTER TABLE output_drafts DROP COLUMN IF EXISTS content_evidence;
