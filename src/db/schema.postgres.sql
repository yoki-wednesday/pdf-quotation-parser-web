-- ==============================================================================
-- Supabase (PostgreSQL) DDL Schema: PDF Quotation Parser Web SPA
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

-- 7. Row Level Security (RLS) 有効化 & ポリシー設定 (anon / authenticated 両方を許可)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow anon all on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow anon all on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow anon all on estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow anon all on estimate_items" ON public.estimate_items;
DROP POLICY IF EXISTS "Allow anon all on import_logs" ON public.import_logs;

DROP POLICY IF EXISTS "Allow all on user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow all on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all on product_master" ON public.product_master;
DROP POLICY IF EXISTS "Allow all on estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow all on estimate_items" ON public.estimate_items;
DROP POLICY IF EXISTS "Allow all on import_logs" ON public.import_logs;

CREATE POLICY "Allow all on user_settings" ON public.user_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on suppliers" ON public.suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_master" ON public.product_master FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on estimates" ON public.estimates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on estimate_items" ON public.estimate_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on import_logs" ON public.import_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
