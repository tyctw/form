-- 先套用 001、002。以 Supabase SQL Editor 的 postgres 身分執行。
BEGIN;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.is_admin()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public'
       AND tablename = 'survey_config' AND policyname = 'Require admin for config inserts' AND permissive = 'RESTRICTIVE')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public'
       AND tablename = 'survey_config' AND policyname = 'Require admin for config updates' AND permissive = 'RESTRICTIVE') THEN
    RAISE EXCEPTION 'Apply migrations 001 and 002 first: submission settings must be protected';
  END IF;
END;
$$;

-- 用戶端只能經過 submit_survey 提交。Restrictive policy 防止殘留 grants/policies 繞過。
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['survey_responses_full', 'survey_responses_skip_ranking'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public insert to ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Block direct survey insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Block direct survey insert" ON public.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (false)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Block direct survey update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Block direct survey update" ON public.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false) WITH CHECK (false)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Block direct survey delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Block direct survey delete" ON public.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false)', t);
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.survey_submission_throttle (
  email text PRIMARY KEY,
  last_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.survey_submission_receipts (
  request_id uuid PRIMARY KEY,
  payload_hash bytea NOT NULL,
  result jsonb NOT NULL
);
ALTER TABLE public.survey_submission_throttle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_submission_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.survey_submission_throttle, public.survey_submission_receipts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_survey(p_payload jsonb, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cfg public.survey_config%ROWTYPE;
  submitted_at timestamptz := clock_timestamp();
  local_today date := (submitted_at AT TIME ZONE 'Asia/Taipei')::date;
  latest_year integer;
  score_active boolean;
  skip_ranking boolean;
  field text;
  value text;
  mail text;
  answers jsonb;
  cleaned_answers jsonb := '{}'::jsonb;
  question jsonb;
  answer jsonb;
  question_id text;
  active_ids text[] := ARRAY[]::text[];
  nmin numeric;
  nmax numeric;
  rmin integer;
  rmax integer;
  invite text;
  expires_at timestamptz;
  receipt public.survey_submission_receipts%ROWTYPE;
  fingerprint bytea;
  result jsonb;
  allowed boolean;
BEGIN
  IF p_request_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' OR octet_length(p_payload::text) > 32768 THEN
    RAISE EXCEPTION '提交內容格式錯誤或超過 32 KB' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE NOT k = ANY(ARRAY[
    'region','examYear','identity','chineseScore','mathScore','englishScore','socialScore',
    'scienceScore','essayScore','email','skipRanking','minRatio','maxRatio',
    'minRankInterval','maxRankInterval','custom_answers'])) THEN
    RAISE EXCEPTION '提交包含不允許的欄位' USING ERRCODE = '22023';
  END IF;

  -- 與前台讀取相同的唯一選擇方式；缺少設定時拒絕提交。
  SELECT * INTO cfg FROM public.survey_config ORDER BY id LIMIT 1 FOR SHARE;
  IF NOT FOUND OR cfg.system_enabled IS NOT TRUE
     OR submitted_at < cfg.system_start_time OR submitted_at > cfg.system_end_time THEN
    RAISE EXCEPTION '表單目前未開放' USING ERRCODE = '22023';
  END IF;

  -- 同一 request id 的並行／網路重送只能建立一筆填答。
  fingerprint := pg_catalog.sha256(pg_catalog.convert_to(p_payload::text, 'UTF8'));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  SELECT * INTO receipt FROM public.survey_submission_receipts WHERE request_id = p_request_id;
  IF FOUND THEN
    IF receipt.payload_hash <> fingerprint THEN
      RAISE EXCEPTION '提交識別碼已被其他內容使用' USING ERRCODE = '22023';
    END IF;
    RETURN receipt.result;
  END IF;

  FOREACH field IN ARRAY ARRAY['region','examYear','identity','email'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string'
       OR length(btrim(p_payload->>field)) = 0 OR length(p_payload->>field) > 254 THEN
      RAISE EXCEPTION '必填欄位格式錯誤：%', field USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF NOT (p_payload->>'region') = ANY(ARRAY['基北區','桃聯區','竹苗區','中投區','彰化區',
    '雲林區','嘉義區','台南區','高雄區','屏東區','宜蘭區','花蓮區','台東區','澎湖區','金門區'])
    OR NOT (p_payload->>'identity') = ANY(ARRAY['學生','家長','老師','補教業']) THEN
    RAISE EXCEPTION '招生區或身分無效' USING ERRCODE = '22023';
  END IF;
  latest_year := extract(year FROM local_today)::integer - 1911
    + CASE WHEN to_char(local_today, 'MMDD') >= '0715' THEN 1 ELSE 0 END;
  IF (p_payload->>'examYear') !~ '^[0-9]{3}$' THEN
    RAISE EXCEPTION '會考年度無效' USING ERRCODE = '22023';
  END IF;
  IF (p_payload->>'examYear')::integer NOT BETWEEN latest_year - 5 AND latest_year THEN
    RAISE EXCEPTION '會考年度超出可填寫範圍' USING ERRCODE = '22023';
  END IF;
  mail := lower(btrim(p_payload->>'email'));
  IF mail !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR mail ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Email 格式無效' USING ERRCODE = '22023';
  END IF;

  score_active := cfg.subject_score_enabled IS TRUE
    AND (cfg.subject_score_start_time IS NULL OR submitted_at >= cfg.subject_score_start_time)
    AND (cfg.subject_score_end_time IS NULL OR submitted_at <= cfg.subject_score_end_time);
  FOREACH field IN ARRAY ARRAY['chineseScore','mathScore','englishScore','socialScore','scienceScore','essayScore'] LOOP
    value := coalesce(p_payload->>field, '');
    IF p_payload ? field AND jsonb_typeof(p_payload->field) NOT IN ('string', 'null') THEN
      RAISE EXCEPTION '成績格式無效：%', field USING ERRCODE = '22023';
    END IF;
    IF score_active AND value = '' THEN
      RAISE EXCEPTION '請填寫所有成績' USING ERRCODE = '22023';
    END IF;
    IF value <> '' AND ((field = 'essayScore' AND NOT value = ANY(ARRAY['0','1','2','3','4','5','6']))
      OR (field <> 'essayScore' AND NOT value = ANY(ARRAY['A++','A+','A','B++','B+','B','C']))) THEN
      RAISE EXCEPTION '成績超出允許範圍：%', field USING ERRCODE = '22023';
    END IF;
    IF NOT score_active AND value <> '' THEN
      RAISE EXCEPTION '成績輸入目前未開放，請重新整理表單' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF jsonb_typeof(p_payload->'skipRanking') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION '略過序位欄位必須為布林值' USING ERRCODE = '22023';
  END IF;
  skip_ranking := (p_payload->>'skipRanking')::boolean;
  IF NOT skip_ranking AND (p_payload->>'examYear')::integer = latest_year
     AND submitted_at < cfg.announcement_date THEN
    RAISE EXCEPTION '序位尚未開放，請略過序位' USING ERRCODE = '22023';
  END IF;
  IF NOT skip_ranking THEN
    FOREACH field IN ARRAY ARRAY['minRatio','maxRatio','minRankInterval','maxRankInterval'] LOOP
      IF jsonb_typeof(p_payload->field) NOT IN ('number', 'string')
         OR p_payload->>field IS NULL OR length(p_payload->>field) > 12
         OR (p_payload->>field) !~ '^[0-9]+([.][0-9]+)?$' THEN
        RAISE EXCEPTION '序位數值格式錯誤：%', field USING ERRCODE = '22023';
      END IF;
    END LOOP;
    nmin := (p_payload->>'minRatio')::numeric;
    nmax := (p_payload->>'maxRatio')::numeric;
    IF nmin < 0 OR nmax > 100 OR nmin > nmax
       OR (p_payload->>'minRankInterval') !~ '^[0-9]+$'
       OR (p_payload->>'maxRankInterval') !~ '^[0-9]+$'
       OR (p_payload->>'minRankInterval')::numeric < 1
       OR (p_payload->>'maxRankInterval')::numeric > 2147483647
       OR (p_payload->>'minRankInterval')::numeric > (p_payload->>'maxRankInterval')::numeric THEN
      RAISE EXCEPTION '序位區間超出範圍或最小值大於最大值' USING ERRCODE = '22023';
    END IF;
    rmin := (p_payload->>'minRankInterval')::integer;
    rmax := (p_payload->>'maxRankInterval')::integer;
  ELSIF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) k
    WHERE k = ANY(ARRAY['minRatio','maxRatio','minRankInterval','maxRankInterval'])
      AND p_payload->k <> 'null'::jsonb AND p_payload->>k <> '') THEN
    RAISE EXCEPTION '略過序位時不可提交序位資料' USING ERRCODE = '22023';
  END IF;

  answers := coalesce(p_payload->'custom_answers', '{}'::jsonb);
  IF jsonb_typeof(answers) <> 'object' OR jsonb_typeof(cfg.custom_questions) <> 'array' THEN
    RAISE EXCEPTION '自訂題目資料格式錯誤' USING ERRCODE = '22023';
  END IF;
  FOR question IN SELECT * FROM jsonb_array_elements(cfg.custom_questions) LOOP
    question_id := question->>'id';
    IF question_id = '__SYSTEM_BACKUPS__' THEN CONTINUE; END IF;
    -- 管理頁 datetime-local 值沒有 offset，明確以台北時間解讀。
    IF nullif(question->>'startTime', '') IS NOT NULL AND submitted_at <
       ((question->>'startTime')::timestamp AT TIME ZONE 'Asia/Taipei') THEN CONTINUE; END IF;
    IF nullif(question->>'endTime', '') IS NOT NULL AND submitted_at >
       ((question->>'endTime')::timestamp AT TIME ZONE 'Asia/Taipei') THEN CONTINUE; END IF;
    IF question_id IS NULL OR question_id = ANY(active_ids) THEN
      RAISE EXCEPTION '自訂題目設定錯誤' USING ERRCODE = '22023';
    END IF;
    active_ids := array_append(active_ids, question_id);
    answer := answers->question_id;
    IF answer IS NULL OR answer = 'null'::jsonb OR answer = '""'::jsonb OR answer = '[]'::jsonb THEN
      IF coalesce((question->>'required')::boolean, false) THEN
        RAISE EXCEPTION '缺少必填自訂題目：%', question_id USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;
    CASE question->>'type'
      WHEN 'text' THEN
        IF jsonb_typeof(answer) <> 'string' OR length(btrim(answer #>> '{}')) = 0
           OR length(answer #>> '{}') > 2000 THEN
          RAISE EXCEPTION '簡答題格式錯誤或超過 2000 字' USING ERRCODE = '22023';
        END IF;
      WHEN 'radio' THEN
        IF jsonb_typeof(answer) <> 'string' OR NOT coalesce((question->'options') @> jsonb_build_array(answer), false) THEN
          RAISE EXCEPTION '單選題選項無效' USING ERRCODE = '22023';
        END IF;
      WHEN 'checkbox' THEN
        IF jsonb_typeof(answer) <> 'array' THEN
          RAISE EXCEPTION '複選題格式錯誤' USING ERRCODE = '22023';
        END IF;
        IF jsonb_array_length(answer) > 100 OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(answer) a
          WHERE jsonb_typeof(a) <> 'string' OR NOT coalesce((question->'options') @> jsonb_build_array(a), false)
        ) OR (SELECT count(*) <> count(DISTINCT a) FROM jsonb_array_elements(answer) a) THEN
          RAISE EXCEPTION '複選題選項無效或重複' USING ERRCODE = '22023';
        END IF;
      ELSE RAISE EXCEPTION '自訂題目類型無效' USING ERRCODE = '22023';
    END CASE;
    cleaned_answers := cleaned_answers || jsonb_build_object(question_id, answer);
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(answers) k WHERE NOT k = ANY(active_ids)) THEN
    RAISE EXCEPTION '包含未開放或不存在的自訂題目' USING ERRCODE = '22023';
  END IF;

  -- 原子化的同 Email 60 秒冷卻；同時請求也不能繞過。
  INSERT INTO public.survey_submission_throttle AS throttle (email, last_at) VALUES (mail, submitted_at)
  ON CONFLICT (email) DO UPDATE SET last_at = excluded.last_at
    WHERE throttle.last_at <= excluded.last_at - interval '60 seconds'
  RETURNING true INTO allowed;
  IF allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION '同一 Email 每 60 秒只能提交一次' USING ERRCODE = '22023';
  END IF;
  invite := 'SH' || to_char(submitted_at AT TIME ZONE 'Asia/Taipei', 'YYYYMMDDHH24');
  expires_at := (date_trunc('hour', submitted_at AT TIME ZONE 'Asia/Taipei') + interval '1 hour') AT TIME ZONE 'Asia/Taipei';
  IF skip_ranking THEN
    INSERT INTO public.survey_responses_skip_ranking (
      timestamp, region, "examYear", identity, "chineseScore", "mathScore", "englishScore",
      "socialScore", "scienceScore", "essayScore", email, "inviteCode", custom_answers
    ) VALUES (submitted_at, p_payload->>'region', p_payload->>'examYear', p_payload->>'identity',
      p_payload->>'chineseScore', p_payload->>'mathScore', p_payload->>'englishScore',
      p_payload->>'socialScore', p_payload->>'scienceScore', p_payload->>'essayScore', mail, invite, cleaned_answers);
  ELSE
    INSERT INTO public.survey_responses_full (
      timestamp, region, "examYear", identity, "chineseScore", "mathScore", "englishScore",
      "socialScore", "scienceScore", "essayScore", email, "inviteCode", custom_answers,
      "minRatio", "maxRatio", "minRankInterval", "maxRankInterval"
    ) VALUES (submitted_at, p_payload->>'region', p_payload->>'examYear', p_payload->>'identity',
      p_payload->>'chineseScore', p_payload->>'mathScore', p_payload->>'englishScore',
      p_payload->>'socialScore', p_payload->>'scienceScore', p_payload->>'essayScore', mail, invite, cleaned_answers,
      nmin, nmax, rmin, rmax);
  END IF;
  result := jsonb_build_object('inviteCode', invite, 'expiration', expires_at);
  INSERT INTO public.survey_submission_receipts VALUES (p_request_id, fingerprint, result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_survey(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_survey(jsonb, uuid) TO anon, authenticated;
COMMIT;
