-- ============================================================================
-- CallMedex Task 5 — Phlebo Kit & Stock Tracking
--
-- DoctorC-style "Current Equipment" model: a kit_items catalog (tubes +
-- containers + consumables) with per-phlebotomist stock counts that
-- auto-decrement as the phlebo collects.
--
-- Idempotent — safe to re-run. RLS is deny-all by default, consistent with
-- the repo posture (lint 0008): the FastAPI backend uses the service key and
-- bypasses RLS.
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. KIT ITEMS CATALOG
--    The DoctorC-style list of everything a phlebotomist carries.
--    Five tube codes mirror the tube_types table so tube stock and tube-type
--    logic stay aligned.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kit_items (
    code TEXT PRIMARY KEY,            -- 'edta_lavender', 'needle', 'gloves_large' …
    name TEXT NOT NULL,               -- display name for the UI
    category TEXT NOT NULL CHECK (category IN ('tube', 'container', 'consumable')),
    cap_colour TEXT DEFAULT '',       -- tubes/containers only
    decrement_event TEXT NOT NULL DEFAULT 'never'
      CHECK (decrement_event IN ('per_tube', 'per_collection', 'never')),
    is_active BOOLEAN DEFAULT true
);

-- Seed: mirror the 5 tube_types (per_tube), plus containers and consumables.
INSERT INTO kit_items (code, name, category, cap_colour, decrement_event) VALUES
    -- Tubes (mirror tube_types codes)
    ('edta_lavender',  'EDTA (Lavender)',   'tube',       'lavender', 'per_tube'),
    ('sst_gold',       'SST (Gold)',        'tube',       'gold',     'per_tube'),
    ('citrate_blue',   'Citrate (Blue)',    'tube',       'blue',     'per_tube'),
    ('fluoride_grey',  'Fluoride (Grey)',   'tube',       'grey',     'per_tube'),
    ('plain_red',      'Plain (Red)',       'tube',       'red',      'per_tube'),
    -- Containers
    ('urine_container', 'Urine Container', 'container',  'yellow',   'per_collection'),
    -- Consumables
    ('needle',           'Needle',           'consumable', '',         'per_collection'),
    ('alcohol_swabs',    'Alcohol Swabs',    'consumable', '',         'per_collection'),
    ('injection_plaster','Injection Plaster','consumable', '',         'per_collection'),
    ('gloves_large',     'Gloves (Large)',   'consumable', '',         'per_collection'),
    ('syringe_2_5ml',    'Syringe 2.5ml',    'consumable', '',         'per_collection'),
    ('syringe_5ml',      'Syringe 5ml',      'consumable', '',         'per_collection'),
    ('sterillium_small', 'Sterillium',       'consumable', '',         'per_collection')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PHLEBOTOMIST STOCK
--    Per-phlebo counts that auto-decrement as samples are collected.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS phlebo_stock (
    phlebotomist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL REFERENCES kit_items(code),
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phlebotomist_user_id, item_code)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 99. RLS — deny-all by default (lint 0008)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.kit_items;
CREATE POLICY "Deny all access" ON public.kit_items
    FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.phlebo_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.phlebo_stock;
CREATE POLICY "Deny all access" ON public.phlebo_stock
    FOR ALL TO public USING (false) WITH CHECK (false);

COMMIT;

NOTIFY pgrst, 'reload schema';