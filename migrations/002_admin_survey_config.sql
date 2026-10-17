-- 先執行 001_private_survey_responses.sql，沿用其管理員名單與 is_admin()。
-- 以 Supabase SQL Editor 的 postgres 身分執行；可重複套用。
BEGIN;
DO $$ BEGIN
    IF pg_catalog.to_regprocedure('public.is_admin()') IS NULL THEN
        RAISE EXCEPTION 'Apply 001_private_survey_responses.sql first';
    END IF;
END; $$;

-- 系統設定僅管理員可新增／修改；與 migrations/002_admin_survey_config.sql 保持一致。
ALTER TABLE public.survey_config ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.survey_config FROM PUBLIC, anon;
REVOKE DELETE, TRUNCATE ON TABLE public.survey_config FROM authenticated;
GRANT SELECT ON TABLE public.survey_config TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.survey_config TO authenticated;

-- 管理頁支援空表時新增設定，identity sequence 須允許登入者取號。
DO $$
DECLARE config_sequence text;
BEGIN
    config_sequence := pg_catalog.pg_get_serial_sequence('public.survey_config', 'id');
    IF config_sequence IS NOT NULL THEN
        EXECUTE pg_catalog.format('GRANT USAGE ON SEQUENCE %s TO authenticated', config_sequence);
    END IF;
END;
$$;

DROP POLICY IF EXISTS "Allow public select on survey_config" ON public.survey_config;
CREATE POLICY "Allow public select on survey_config" ON public.survey_config
FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated update on survey_config" ON public.survey_config;
DROP POLICY IF EXISTS "Allow authenticated insert on survey_config" ON public.survey_config;

DROP POLICY IF EXISTS "Admin insert survey config" ON public.survey_config;
CREATE POLICY "Admin insert survey config" ON public.survey_config
FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Admin update survey config" ON public.survey_config;
CREATE POLICY "Admin update survey config" ON public.survey_config
FOR UPDATE TO authenticated
USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 阻擋殘留的寬鬆 INSERT / UPDATE / ALL policy 與欄位層級授權繞過。
DROP POLICY IF EXISTS "Require admin for config inserts" ON public.survey_config;
CREATE POLICY "Require admin for config inserts" ON public.survey_config
AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Require admin for config updates" ON public.survey_config;
CREATE POLICY "Require admin for config updates" ON public.survey_config
AS RESTRICTIVE FOR UPDATE TO PUBLIC
USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Prevent client config deletes" ON public.survey_config;
CREATE POLICY "Prevent client config deletes" ON public.survey_config
AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);

COMMIT;
