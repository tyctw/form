-- Apply after migrations 001–004. All RPCs use caller privileges and existing RLS.
BEGIN;
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.is_admin()') IS NULL
    OR pg_catalog.to_regclass('public.survey_responses_full') IS NULL
    OR pg_catalog.to_regclass('public.survey_responses_skip_ranking') IS NULL THEN
    RAISE EXCEPTION 'Apply the base schema and migration 001 before migration 005';
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS survey_full_admin_date_idx ON public.survey_responses_full (timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS survey_skip_admin_date_idx ON public.survey_responses_skip_ranking (timestamp DESC, id DESC);

CREATE OR REPLACE FUNCTION public.admin_filtered_surveys(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(source text, id bigint, submitted_at timestamptz, row_data jsonb, score integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object'
    OR coalesce(p_filters->>'ranking','all') NOT IN ('all','full','skip') THEN
    RAISE EXCEPTION 'Invalid filters' USING ERRCODE = '22023';
  END IF;
  IF nullif(p_filters->>'startDate','')::date > nullif(p_filters->>'endDate','')::date THEN
    RAISE EXCEPTION '開始日期不可晚於結束日期' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH combined AS (
    SELECT 'full'::text AS kind, f.id AS row_id, f.timestamp AS at, to_jsonb(f) AS body
    FROM public.survey_responses_full f WHERE coalesce(p_filters->>'ranking','all') IN ('all','full')
    UNION ALL
    SELECT 'skip'::text, s.id, s.timestamp, to_jsonb(s)
    FROM public.survey_responses_skip_ranking s WHERE coalesce(p_filters->>'ranking','all') IN ('all','skip')
  )
  SELECT c.kind, c.row_id, c.at, c.body,
    (SELECT sum(CASE v WHEN 'A++' THEN 7 WHEN 'A+' THEN 6 WHEN 'A' THEN 5
      WHEN 'B++' THEN 4 WHEN 'B+' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END)::integer
     FROM unnest(ARRAY[c.body->>'chineseScore',c.body->>'mathScore',c.body->>'englishScore',
       c.body->>'socialScore',c.body->>'scienceScore']) AS v)
  FROM combined c
  WHERE (coalesce(p_filters->>'examYear','') = '' OR c.body->>'examYear' = p_filters->>'examYear')
    AND (coalesce(p_filters->>'region','') = '' OR c.body->>'region' = p_filters->>'region')
    AND (coalesce(p_filters->>'identity','') = '' OR c.body->>'identity' = p_filters->>'identity')
    AND (coalesce(p_filters->>'startDate','') = '' OR c.at >= (p_filters->>'startDate')::date::timestamp AT TIME ZONE 'Asia/Taipei')
    AND (coalesce(p_filters->>'endDate','') = '' OR c.at < ((p_filters->>'endDate')::date + 1)::timestamp AT TIME ZONE 'Asia/Taipei')
    AND (coalesce(p_filters->>'search','') = '' OR strpos(lower(concat_ws(' ',
      c.body->>'region', c.body->>'identity', c.body->>'examYear',c.body->>'email',
      c.body->>'chineseScore',c.body->>'mathScore',c.body->>'englishScore',c.body->>'socialScore',
      c.body->>'scienceScore',c.body->>'essayScore',c.body->>'custom_answers')), lower(p_filters->>'search')) > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_survey_page(p_filters jsonb DEFAULT '{}'::jsonb,
  p_kind text DEFAULT 'all', p_offset integer DEFAULT 0, p_limit integer DEFAULT 50,
  p_sort text DEFAULT 'timestamp', p_ascending boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('all','full','skip') OR p_offset IS NULL OR p_offset < 0
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
    OR p_ascending IS NULL OR p_sort IS NULL OR p_sort NOT IN ('timestamp','region','identity','examYear','totalScore') THEN
    RAISE EXCEPTION 'Invalid pagination' USING ERRCODE = '22023';
  END IF;
  WITH filtered AS MATERIALIZED (
    SELECT * FROM public.admin_filtered_surveys(p_filters) f WHERE p_kind = 'all' OR f.source = p_kind
  ), page AS (
    SELECT * FROM filtered f
    ORDER BY
      CASE WHEN p_sort = 'timestamp' AND p_ascending THEN f.submitted_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'timestamp' AND NOT p_ascending THEN f.submitted_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'totalScore' AND p_ascending THEN f.score END ASC NULLS LAST,
      CASE WHEN p_sort = 'totalScore' AND NOT p_ascending THEN f.score END DESC NULLS LAST,
      CASE WHEN p_sort IN ('region','identity','examYear') AND p_ascending THEN f.row_data->>p_sort END ASC NULLS LAST,
      CASE WHEN p_sort IN ('region','identity','examYear') AND NOT p_ascending THEN f.row_data->>p_sort END DESC NULLS LAST,
      f.submitted_at DESC, f.source, f.id DESC
    LIMIT p_limit OFFSET p_offset
  ) SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),
    'rows',coalesce((SELECT jsonb_agg(row_data || jsonb_build_object('_source',source)) FROM page),'[]'::jsonb)) INTO result;
  RETURN result;
END;
$$;

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
REVOKE ALL ON FUNCTION public.admin_filtered_surveys(jsonb), public.admin_survey_page(jsonb,text,integer,integer,text,boolean), public.admin_survey_stats(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_filtered_surveys(jsonb), public.admin_survey_page(jsonb,text,integer,integer,text,boolean), public.admin_survey_stats(jsonb) TO authenticated;

-- Export uses ID cursors and initial high-water marks so concurrent new responses do not shift pages.
CREATE OR REPLACE FUNCTION public.admin_survey_export(p_filters jsonb DEFAULT '{}'::jsonb,
  p_kind text DEFAULT 'all', p_after_source text DEFAULT '', p_after_id bigint DEFAULT 0,
  p_full_max bigint DEFAULT NULL, p_skip_max bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('all','full','skip')
    OR p_after_source IS NULL OR p_after_source NOT IN ('','full','skip') OR p_after_id IS NULL
    OR (p_full_max IS NULL) <> (p_skip_max IS NULL)
    OR (p_after_source <> '' AND p_full_max IS NULL) THEN
    RAISE EXCEPTION 'Invalid export cursor' USING ERRCODE = '22023';
  END IF;
  WITH filtered AS MATERIALIZED (
    SELECT * FROM public.admin_filtered_surveys(p_filters) f WHERE p_kind='all' OR f.source=p_kind
  ), bounds AS (
    SELECT coalesce(p_full_max, max(id) FILTER (WHERE source='full'), 0) AS full_max,
      coalesce(p_skip_max, max(id) FILTER (WHERE source='skip'), 0) AS skip_max FROM filtered
  ), page AS (
    SELECT f.* FROM filtered f CROSS JOIN bounds b
    WHERE f.id <= CASE WHEN f.source='full' THEN b.full_max ELSE b.skip_max END
      AND (p_after_source='' OR (f.source,f.id) > (p_after_source,p_after_id))
    ORDER BY f.source,f.id LIMIT 500
  ) SELECT jsonb_build_object('fullMax',b.full_max,'skipMax',b.skip_max,
      'rows',coalesce((SELECT jsonb_agg(row_data || jsonb_build_object('_source',source) ORDER BY source,id) FROM page),'[]'::jsonb))
    INTO result FROM bounds b;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_survey_export(jsonb,text,text,bigint,bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_survey_export(jsonb,text,text,bigint,bigint,bigint) TO authenticated;
COMMIT;
