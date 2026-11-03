-- Apply after 001–005. Existing direct admin maintenance remains authorized.
BEGIN;
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.is_admin()') IS NULL
    OR pg_catalog.to_regprocedure('public.admin_survey_export(jsonb,text,text,bigint,bigint,bigint)') IS NULL
    OR pg_catalog.to_regprocedure('public.admin_survey_stats(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Apply migrations 001–005 before migration 006';
  END IF;
END;
$$;
ALTER TABLE public.survey_config ADD COLUMN IF NOT EXISTS announcement_content jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.survey_config ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.survey_config ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE OR REPLACE FUNCTION public.bump_survey_config_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.revision := CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.revision + 1 END;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bump_survey_config_revision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS survey_config_revision ON public.survey_config;
CREATE TRIGGER survey_config_revision BEFORE INSERT OR UPDATE ON public.survey_config
FOR EACH ROW EXECUTE FUNCTION public.bump_survey_config_revision();

CREATE OR REPLACE FUNCTION public.publish_survey_config(p_id bigint, p_revision bigint, p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE cfg public.survey_config%ROWTYPE; q jsonb; start_at timestamptz; end_at timestamptz;
  score_start timestamptz; score_end timestamptz; qs timestamp; qe timestamp; history jsonb; payload jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
  -- Serialize initial creation; row lock also coordinates direct administrator updates.
  PERFORM pg_catalog.pg_advisory_xact_lock(704203618);
  SELECT * INTO cfg FROM public.survey_config ORDER BY id LIMIT 1 FOR UPDATE;
  IF (cfg.id IS DISTINCT FROM p_id) OR (cfg.revision IS DISTINCT FROM p_revision) THEN
    RETURN jsonb_build_object('status','conflict','current',CASE WHEN cfg.id IS NULL THEN NULL ELSE to_jsonb(cfg) END);
  END IF;
  IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object' OR octet_length(p_settings::text)>262144
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_settings) k WHERE NOT k=ANY(ARRAY[
      'announcement_date','announcement_content','custom_questions','subject_score_start_time','subject_score_end_time',
      'subject_score_enabled','system_start_time','system_end_time','system_enabled']))
    OR jsonb_typeof(p_settings->'system_enabled') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_settings->'subject_score_enabled') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_settings->'custom_questions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_settings->'announcement_content') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION '設定格式無效' USING ERRCODE='22023';
  END IF;
  start_at := (p_settings->>'system_start_time')::timestamptz;
  end_at := (p_settings->>'system_end_time')::timestamptz;
  score_start := (p_settings->>'subject_score_start_time')::timestamptz;
  score_end := (p_settings->>'subject_score_end_time')::timestamptz;
  IF start_at >= end_at OR score_start >= score_end THEN
    RAISE EXCEPTION '開始時間必須早於結束時間' USING ERRCODE='22023';
  END IF;
  IF (p_settings->>'subject_score_enabled')::boolean AND (score_start>end_at OR score_end<start_at) THEN
    RAISE EXCEPTION '成績輸入與表單開放時間沒有交集' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_settings->'custom_questions') v
      WHERE jsonb_typeof(v) IS DISTINCT FROM 'object' OR coalesce(v->>'id','') IN ('','__SYSTEM_BACKUPS__')
      OR coalesce(v->>'question','') ~ '^\s*$' OR coalesce(v->>'type','') NOT IN ('text','radio','checkbox')
      OR (v ? 'required' AND jsonb_typeof(v->'required') IS DISTINCT FROM 'boolean'))
    OR (SELECT count(*)<>count(DISTINCT v->>'id') FROM jsonb_array_elements(p_settings->'custom_questions') v) THEN
    RAISE EXCEPTION '題目文字、識別碼或類型無效' USING ERRCODE='22023';
  END IF;
  FOR q IN SELECT * FROM jsonb_array_elements(p_settings->'custom_questions') LOOP
    qs:=nullif(q->>'startTime','')::timestamp; qe:=nullif(q->>'endTime','')::timestamp;
    IF qs>=qe OR (qs AT TIME ZONE 'Asia/Taipei')>end_at OR (qe AT TIME ZONE 'Asia/Taipei')<start_at THEN
      RAISE EXCEPTION '題目時間與表單衝突' USING ERRCODE='22023';
    END IF;
    IF q->>'type'<>'text' THEN
      IF jsonb_typeof(q->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '題目選項無效' USING ERRCODE='22023'; END IF;
      IF jsonb_array_length(q->'options')=0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') v WHERE jsonb_typeof(v)<>'string' OR (v#>>'{}') ~ '^\s*$')
        OR (SELECT count(*)<>count(DISTINCT v) FROM jsonb_array_elements(q->'options') v) THEN
        RAISE EXCEPTION '題目選項不可空白或重複' USING ERRCODE='22023';
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_settings->'announcement_content') x
    WHERE x.key NOT IN ('title','body','linkLabel','linkUrl') OR jsonb_typeof(x.value)<>'string')
    OR (coalesce(p_settings->'announcement_content'->>'linkUrl','')<>'' AND (p_settings->'announcement_content'->>'linkUrl') !~* '^https?://') THEN
    RAISE EXCEPTION '公告內容或連結無效' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(v->'data','[]'::jsonb) INTO history FROM jsonb_array_elements(coalesce(cfg.custom_questions,'[]'::jsonb)) v WHERE v->>'id'='__SYSTEM_BACKUPS__' LIMIT 1;
  history:=jsonb_build_array(p_settings || jsonb_build_object('timestamp',clock_timestamp())) || coalesce(history,'[]'::jsonb);
  SELECT coalesce(jsonb_agg(v),'[]'::jsonb) INTO history FROM (SELECT v FROM jsonb_array_elements(history) v LIMIT 3) x;
  payload:=p_settings || jsonb_build_object('custom_questions',(p_settings->'custom_questions') || jsonb_build_array(jsonb_build_object('id','__SYSTEM_BACKUPS__','data',history)));
  IF cfg.id IS NULL THEN
    INSERT INTO public.survey_config(announcement_date,announcement_content,custom_questions,subject_score_start_time,subject_score_end_time,subject_score_enabled,system_start_time,system_end_time,system_enabled)
    VALUES ((payload->>'announcement_date')::timestamptz,payload->'announcement_content',payload->'custom_questions',score_start,score_end,(payload->>'subject_score_enabled')::boolean,start_at,end_at,(payload->>'system_enabled')::boolean) RETURNING * INTO cfg;
  ELSE
    UPDATE public.survey_config SET announcement_date=(payload->>'announcement_date')::timestamptz,
      announcement_content=payload->'announcement_content',custom_questions=payload->'custom_questions',
      subject_score_start_time=score_start,subject_score_end_time=score_end,subject_score_enabled=(payload->>'subject_score_enabled')::boolean,
      system_start_time=start_at,system_end_time=end_at,system_enabled=(payload->>'system_enabled')::boolean
    WHERE id=cfg.id RETURNING * INTO cfg;
    IF NOT FOUND THEN RAISE EXCEPTION '無權發布這份設定' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN jsonb_build_object('status','saved','current',to_jsonb(cfg));
END;
$$;
REVOKE ALL ON FUNCTION public.publish_survey_config(bigint,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_survey_config(bigint,bigint,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_survey_stats(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501'; END IF;
  WITH filtered AS MATERIALIZED (SELECT * FROM public.admin_filtered_surveys(p_filters)),
  regions AS (SELECT row_data->>'region' AS name,count(*) AS count FROM filtered GROUP BY 1),
  identities AS (SELECT coalesce(nullif(row_data->>'identity',''),'未提供') AS name,count(*) AS count FROM filtered GROUP BY 1),
  scores AS (
    SELECT CASE WHEN ARRAY[row_data->>'chineseScore',row_data->>'mathScore',row_data->>'englishScore',
      row_data->>'socialScore',row_data->>'scienceScore'] <@ ARRAY['A++','A+','A','B++','B+','B','C']
      AND array_position(ARRAY[row_data->>'chineseScore',row_data->>'mathScore',row_data->>'englishScore',
        row_data->>'socialScore',row_data->>'scienceScore'],NULL) IS NULL
      THEN (score / 5 * 5)::text || '-' || (score / 5 * 5 + 4)::text || ' 積分'
      ELSE '未完整填寫' END AS name, count(*) AS count FROM filtered GROUP BY 1
  ), days AS (SELECT to_char(submitted_at AT TIME ZONE 'Asia/Taipei','YYYY-MM-DD') AS date,count(*) AS count FROM filtered GROUP BY 1),
  facets AS MATERIALIZED (SELECT row_data FROM public.admin_filtered_surveys('{}'::jsonb))
  SELECT jsonb_build_object('total',count(*),'full',count(*) FILTER (WHERE source='full'),
    'skip',count(*) FILTER (WHERE source='skip'),
    'valid',count(*) FILTER (WHERE
      ARRAY[row_data->>'chineseScore',row_data->>'mathScore',row_data->>'englishScore',row_data->>'socialScore',row_data->>'scienceScore'] <@ ARRAY['A++','A+','A','B++','B+','B','C']
      AND array_position(ARRAY[row_data->>'chineseScore',row_data->>'mathScore',row_data->>'englishScore',row_data->>'socialScore',row_data->>'scienceScore'],NULL) IS NULL
      AND (source='skip' OR (row_data->>'minRatio')::numeric BETWEEN 0 AND 100
        AND (row_data->>'maxRatio')::numeric BETWEEN (row_data->>'minRatio')::numeric AND 100
        AND (row_data->>'minRankInterval')::numeric>=1 AND (row_data->>'maxRankInterval')::numeric>=(row_data->>'minRankInterval')::numeric)),
    'recentDays', (SELECT jsonb_agg(jsonb_build_object('date',to_char(day,'YYYY-MM-DD'),'count',coalesce(d.count,0)) ORDER BY day)
      FROM generate_series((now() AT TIME ZONE 'Asia/Taipei')::date-6,(now() AT TIME ZONE 'Asia/Taipei')::date,interval '1 day') day
      LEFT JOIN days d ON d.date=to_char(day,'YYYY-MM-DD')),
    'formStatus',coalesce((SELECT jsonb_build_object('enabled',c.system_enabled,'start',c.system_start_time,'end',c.system_end_time,
      'state',CASE WHEN c.system_enabled IS NOT TRUE THEN 'closed' WHEN now()<c.system_start_time THEN 'scheduled' WHEN now()>c.system_end_time THEN 'ended' ELSE 'open' END,
      'checkedAt',now()) FROM public.survey_config c ORDER BY c.id LIMIT 1),'{"state":"missing"}'::jsonb),
    'today',count(*) FILTER (WHERE (submitted_at AT TIME ZONE 'Asia/Taipei')::date = (now() AT TIME ZONE 'Asia/Taipei')::date),
    'regions',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.count DESC,r.name) FROM regions r),'[]'::jsonb),
    'identities',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.count DESC,i.name) FROM identities i),'[]'::jsonb),
    'scores',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM scores s),'[]'::jsonb),
    'days',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.date) FROM days d),'[]'::jsonb),
    'years',coalesce((SELECT jsonb_agg(y ORDER BY y DESC) FROM (SELECT DISTINCT row_data->>'examYear' y FROM facets WHERE row_data->>'examYear' IS NOT NULL) x),'[]'::jsonb),
    'regionOptions',coalesce((SELECT jsonb_agg(y ORDER BY y) FROM (SELECT DISTINCT row_data->>'region' y FROM facets WHERE row_data->>'region' IS NOT NULL) x),'[]'::jsonb),
    'identityOptions',coalesce((SELECT jsonb_agg(y ORDER BY y) FROM (SELECT DISTINCT row_data->>'identity' y FROM facets WHERE nullif(row_data->>'identity','') IS NOT NULL) x),'[]'::jsonb)
  ) INTO result FROM filtered;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_survey_stats(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_survey_stats(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_survey_export_selected(p_filters jsonb DEFAULT '{}'::jsonb,
  p_kind text DEFAULT 'all', p_after_source text DEFAULT '', p_after_id bigint DEFAULT 0,
  p_full_max bigint DEFAULT NULL, p_skip_max bigint DEFAULT NULL,
  p_fields text[] DEFAULT ARRAY['timestamp','examYear','region','identity','chineseScore','mathScore','englishScore','socialScore','scienceScore','essayScore','minRatio','maxRatio','minRankInterval','maxRankInterval','email','inviteCode','custom_answers'],
  p_include_personal boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb; projected jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
  IF p_fields IS NULL OR cardinality(p_fields)=0 OR cardinality(p_fields)>17
    OR array_position(p_fields,NULL) IS NOT NULL OR p_include_personal IS NULL
    OR NOT p_fields <@ ARRAY['timestamp','examYear','region','identity','chineseScore','mathScore','englishScore','socialScore','scienceScore','essayScore','minRatio','maxRatio','minRankInterval','maxRankInterval','email','inviteCode','custom_answers']::text[] THEN
    RAISE EXCEPTION '請選擇有效的匯出欄位' USING ERRCODE='22023';
  END IF;
  result:=public.admin_survey_export(p_filters,p_kind,p_after_source,p_after_id,p_full_max,p_skip_max);
  SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(e.key,CASE WHEN e.key='email' AND NOT p_include_personal
      THEN to_jsonb(CASE WHEN coalesce(e.value#>>'{}','')='' THEN '' ELSE '***@***' END) ELSE e.value END)
    FROM jsonb_each(r) e WHERE e.key=ANY(p_fields) OR e.key IN ('id','_source')) ORDER BY ord),'[]'::jsonb)
    INTO projected FROM jsonb_array_elements(result->'rows') WITH ORDINALITY rows(r,ord);
  RETURN result || jsonb_build_object('rows',projected);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_survey_export_selected(jsonb,text,text,bigint,bigint,bigint,text[],boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_survey_export_selected(jsonb,text,text,bigint,bigint,bigint,text[],boolean) TO authenticated;
COMMIT;
