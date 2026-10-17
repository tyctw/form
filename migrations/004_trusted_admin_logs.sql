-- 先套用 001（管理員名單）。以 Supabase SQL Editor 的 postgres 身分執行。
-- 必須開啟 Authentication > Audit Logs > Write audit logs to the database。
BEGIN;
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.is_admin()') IS NULL
     OR pg_catalog.to_regclass('public.survey_admins') IS NULL THEN
    RAISE EXCEPTION 'Apply migration 001 first';
  END IF;
  IF pg_catalog.to_regclass('auth.audit_log_entries') IS NULL THEN
    RAISE EXCEPTION 'Supabase auth.audit_log_entries is required for trusted login logging';
  END IF;
END;
$$;

-- 舊資料可能由任意客戶端偽造，不將其升格為可信紀錄。
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS event_source text NOT NULL DEFAULT 'legacy_unverified';
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS auth_event_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS admin_logs_auth_event_id_key ON public.admin_logs (auth_event_id);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_logs TO authenticated;

DO $$
DECLARE log_sequence text;
BEGIN
  log_sequence := pg_catalog.pg_get_serial_sequence('public.admin_logs', 'id');
  IF log_sequence IS NOT NULL THEN
    EXECUTE pg_catalog.format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', log_sequence);
    -- 舊版可由客戶端指定 id，修正 sequence 落後資料的情況，避免可信事件撞到舊 id。
    PERFORM pg_catalog.setval(log_sequence::regclass, greatest(
      coalesce(pg_catalog.pg_sequence_last_value(log_sequence::regclass), 1),
      coalesce((SELECT max(id) FROM public.admin_logs), 1)
    ), true);
  END IF;
  -- 舊 SECURITY DEFINER 密碼驗證函式會寫日誌，必須同時封鎖這條間接偽造路徑。
  IF pg_catalog.to_regprocedure('public.verify_admin_password(text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.verify_admin_password(text, text) FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Allow public insert on admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Allow public select on admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admin read audit logs" ON public.admin_logs;
CREATE POLICY "Admin read audit logs" ON public.admin_logs
FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Require admin for log reads" ON public.admin_logs;
CREATE POLICY "Require admin for log reads" ON public.admin_logs
AS RESTRICTIVE FOR SELECT TO PUBLIC USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Block client log insert" ON public.admin_logs;
CREATE POLICY "Block client log insert" ON public.admin_logs
AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (false);
DROP POLICY IF EXISTS "Block client log update" ON public.admin_logs;
CREATE POLICY "Block client log update" ON public.admin_logs
AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Block client log delete" ON public.admin_logs;
CREATE POLICY "Block client log delete" ON public.admin_logs
AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);

-- 不賦予用戶端 Auth 稽核來源表的權限；Auth 服務的既有權限維持原狀。
REVOKE ALL ON auth.audit_log_entries FROM PUBLIC, anon, authenticated;
DO $$
DECLARE source_columns text;
BEGIN
  SELECT string_agg(pg_catalog.quote_ident(attname), ', ') INTO source_columns
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'auth.audit_log_entries'::regclass AND attnum > 0 AND NOT attisdropped;
  IF source_columns IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'REVOKE ALL (%s) ON auth.audit_log_entries FROM PUBLIC, anon, authenticated', source_columns);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_admin_auth_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor uuid;
BEGIN
  -- 僅接受 Auth 服務的成功登入事件；忽略 user_metadata、瀏覽器聲稱的狀態及 headers。
  IF NEW.payload->>'action' IS DISTINCT FROM 'login'
     OR NEW.payload->>'log_type' IS DISTINCT FROM 'account'
     OR NEW.id IS NULL OR NEW.created_at IS NULL
     OR coalesce(NEW.payload->>'actor_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NEW;
  END IF;
  actor := (NEW.payload->>'actor_id')::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.survey_admins WHERE user_id = actor) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.admin_logs (
    login_time, status, ip_address, user_agent, event_source, actor_user_id, auth_event_id
  ) VALUES (
    NEW.created_at, 'SUCCESS', nullif(NEW.ip_address, ''), NULL,
    'supabase_auth', actor, NEW.id
  ) ON CONFLICT (auth_event_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_admin_auth_login() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS capture_admin_auth_login ON auth.audit_log_entries;
CREATE TRIGGER capture_admin_auth_login
AFTER INSERT ON auth.audit_log_entries
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_auth_login();
COMMIT;
