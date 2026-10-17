-- 既有資料庫修復：以 Supabase SQL Editor 的 postgres 身分執行。
BEGIN;
ALTER TABLE public.survey_responses_full ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses_skip_ranking ENABLE ROW LEVEL SECURITY;

-- 填答資料僅管理員可讀；與 migrations/001_private_survey_responses.sql 保持一致
-- ==========================================
CREATE TABLE IF NOT EXISTS public.survey_admins (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.survey_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.survey_admins FROM PUBLIC, anon, authenticated;

-- 名單只能由資料庫管理者維護；不可使用使用者可自行修改的 user_metadata。
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.survey_admins
        WHERE user_id = (SELECT auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

REVOKE SELECT ON TABLE public.survey_responses_full, public.survey_responses_skip_ranking FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.survey_responses_full, public.survey_responses_skip_ranking TO authenticated;

DROP POLICY IF EXISTS "Allow public select on survey_responses_full" ON public.survey_responses_full;
DROP POLICY IF EXISTS "Allow public select on survey_responses_skip_ranking" ON public.survey_responses_skip_ranking;

DROP POLICY IF EXISTS "Admin read survey responses" ON public.survey_responses_full;
CREATE POLICY "Admin read survey responses" ON public.survey_responses_full
FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Admin read survey responses" ON public.survey_responses_skip_ranking;
CREATE POLICY "Admin read survey responses" ON public.survey_responses_skip_ranking
FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- Restrictive policy 確保其他殘留的 permissive SELECT / ALL policy 也不能放行非管理員。
DROP POLICY IF EXISTS "Require admin for survey reads" ON public.survey_responses_full;
CREATE POLICY "Require admin for survey reads" ON public.survey_responses_full
AS RESTRICTIVE FOR SELECT TO PUBLIC USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Require admin for survey reads" ON public.survey_responses_skip_ranking;
CREATE POLICY "Require admin for survey reads" ON public.survey_responses_skip_ranking
AS RESTRICTIVE FOR SELECT TO PUBLIC USING ((SELECT public.is_admin()));


COMMIT;
