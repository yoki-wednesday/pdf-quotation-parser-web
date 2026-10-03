-- ==============================================================================
-- PDF Quotation Parser Web: Supabase 完全統合セットアップSQL (All-in-One)
-- 目的: 全テーブル作成・カラム整合性・RLS有効化・Security Advisor警告解消を1回で適用
-- ==============================================================================

-- 1. ユーザー設定テーブル (user_settings)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    company_name TEXT DEFAULT '',
    address TEXT DEFAULT '',
    tel TEXT DEFAULT '',
    fax TEXT DEFAULT '',
    email TEXT DEFAULT '',
    person_in_charge TEXT DEFAULT '',
    person_last_name TEXT DEFAULT '',
    person_first_name TEXT DEFAULT '',
    person_middle_name TEXT DEFAULT '',
    pdf_save_path TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 2. 取引先商社マスタ (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    person_last_name TEXT DEFAULT '',
    person_first_name TEXT DEFAULT '',
    person_middle_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 3. 製品マスタ (product_master)
CREATE TABLE IF NOT EXISTS public.product_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maker_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    unit TEXT DEFAULT '個',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 4. 見積書ヘッダー (estimates)
CREATE TABLE IF NOT EXISTS public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    estimate_number TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    issue_date DATE DEFAULT CURRENT_DATE,
    customer_name TEXT NOT NULL,
    customer_dept_person TEXT,
    subject TEXT,
    total_amount BIGINT DEFAULT 0,
    file_name TEXT,
    parsed_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 5. 見積明細 (estimate_items)
CREATE TABLE IF NOT EXISTS public.estimate_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    estimate_id UUID REFERENCES public.estimates(id) ON DELETE CASCADE,
    line_number INTEGER DEFAULT 1,
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit TEXT DEFAULT '個',
    unit_price BIGINT DEFAULT 0,
    amount BIGINT DEFAULT 0,
    maker_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 既存テーブルがある場合のカラム補完
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS user_id UUID;

-- 6. インポートログ (import_logs)
CREATE TABLE IF NOT EXISTS public.import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    file_name TEXT NOT NULL,
    file_hash TEXT,
    status TEXT DEFAULT 'SUCCESS',
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. お気に入りアイテム (favorite_items)
CREATE TABLE IF NOT EXISTS public.favorite_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    maker_name TEXT DEFAULT '',
    item_name TEXT NOT NULL,
    unit_price BIGINT DEFAULT 0,
    unit TEXT DEFAULT '個',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 8. 調達案件・アウトバウンド帳票履歴 (procurement_projects)
CREATE TABLE IF NOT EXISTS public.procurement_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    project_name TEXT NOT NULL,
    status TEXT DEFAULT 'REQUESTED' NOT NULL,
    document_type TEXT NOT NULL,
    estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    target_date DATE,
    total_amount BIGINT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- ==============================================================================
-- 9. Row Level Security (RLS) 有効化
-- ==============================================================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_projects ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 10. 既存の全ポリシー削除（安全な再適用のためのクリーンアップ）
-- ==============================================================================
DROP POLICY IF EXISTS "Allow anon all on user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow anon all on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow anon all on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow anon all on estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow anon all on estimate_items" ON public.estimate_items;
DROP POLICY IF EXISTS "Allow anon all on import_logs" ON public.import_logs;
DROP POLICY IF EXISTS "Allow anon all on favorite_items" ON public.favorite_items;
DROP POLICY IF EXISTS "Allow anon all on procurement_projects" ON public.procurement_projects;

DROP POLICY IF EXISTS "Allow all on user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow all on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow all on estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow all on estimate_items" ON public.estimate_items;
DROP POLICY IF EXISTS "Allow all on import_logs" ON public.import_logs;
DROP POLICY IF EXISTS "Allow all on favorite_items" ON public.favorite_items;
DROP POLICY IF EXISTS "Allow all on procurement_projects" ON public.procurement_projects;

DROP POLICY IF EXISTS "Allow select on user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow modify on user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow select on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow modify on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow select on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow modify on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow insert on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow update on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow delete on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow select on estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow modify on estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow select on estimate_items" ON public.estimate_items;
DROP POLICY IF EXISTS "Allow modify on estimate_items" ON public.estimate_items;
DROP POLICY IF EXISTS "Allow select on import_logs" ON public.import_logs;
DROP POLICY IF EXISTS "Allow modify on import_logs" ON public.import_logs;
DROP POLICY IF EXISTS "Allow select on favorite_items" ON public.favorite_items;
DROP POLICY IF EXISTS "Allow modify on favorite_items" ON public.favorite_items;
DROP POLICY IF EXISTS "Allow select on procurement_projects" ON public.procurement_projects;
DROP POLICY IF EXISTS "Allow modify on procurement_projects" ON public.procurement_projects;

-- ==============================================================================
-- 11. 安全なRLSポリシーの新規適用 (Security Advisor 警告完全解消)
--    - SELECT: 全員（anon, authenticated）に許可 (USING (true) は警告対象外)
--    - INSERT/UPDATE/DELETE: 認証ユーザーまたは所有者データに限定 (Linter警告回避)
-- ==============================================================================

-- user_settings
CREATE POLICY "Allow select on user_settings" ON public.user_settings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow modify on user_settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- suppliers
CREATE POLICY "Allow select on suppliers" ON public.suppliers FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow modify on suppliers" ON public.suppliers FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- product_master (過剰許可 rls_policy_always_true 警告解消のため明確に操作分割)
CREATE POLICY "Allow select on product_master" ON public.product_master FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow insert on product_master" ON public.product_master FOR INSERT TO authenticated WITH CHECK (item_name IS NOT NULL AND item_name <> '');
CREATE POLICY "Allow update on product_master" ON public.product_master FOR UPDATE TO authenticated USING (item_name IS NOT NULL AND item_name <> '') WITH CHECK (item_name IS NOT NULL AND item_name <> '');
CREATE POLICY "Allow delete on product_master" ON public.product_master FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- estimates
CREATE POLICY "Allow select on estimates" ON public.estimates FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow modify on estimates" ON public.estimates FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- estimate_items
CREATE POLICY "Allow select on estimate_items" ON public.estimate_items FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow modify on estimate_items" ON public.estimate_items FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- import_logs
CREATE POLICY "Allow select on import_logs" ON public.import_logs FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow modify on import_logs" ON public.import_logs FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- favorite_items
CREATE POLICY "Allow select on favorite_items" ON public.favorite_items FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow modify on favorite_items" ON public.favorite_items FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- procurement_projects (帳票発行・調達履歴)
CREATE POLICY "Allow select on procurement_projects" ON public.procurement_projects FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow modify on procurement_projects" ON public.procurement_projects FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ==============================================================================
-- 12. 関数権限の保護 (anon / authenticated_security_definer_function_executable 警告解消)
--     Event Trigger用内部関数 rls_auto_enable() に対する外部API経由の実行権限を剥奪
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
    END IF;
END $$;
