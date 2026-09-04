-- ============================================================================
-- Migration: task12_tube_requirements_full_catalog.sql
-- Description: Every bookable test now declares the tube/container it needs.
--
--              task1 seeded 10 tests with a home_service_tubes row. task8 then
--              added ~498 more tests to home_services and NO tube rows at all.
--              derive_tubes() treats "no tube row" as "this service draws no
--              blood" (backend/app/services/tube_derivation.py), so for ~98%
--              of the catalog a home collection was provisioned with ZERO
--              tubes: the collector arrived at the patient's door with nothing
--              telling them what to draw, and no barcode was ever minted.
--
--              Also adds the five container types the catalog needs and never
--              had: black ESR, green lithium-heparin, blood culture bottle,
--              urine container, swab transport tube.
--
--              ESR is corrected from citrate (blue) to the dedicated black
--              ESR tube. task1 mapped it to citrate_blue; a Westergren ESR
--              runs in a black 3.8% citrate tube, and a coagulation blue-top
--              is a different fill ratio.
--
-- Serum tube choice: the platform's serum tube is SST/gold (already stocked in
--              kit_items, already used by the 10 task1 mappings). Plain red is
--              clinically interchangeable for this panel. Everything below
--              routes serum work through the `serum` CTE -- change that ONE
--              literal to 'plain_red' if operations would rather draw red
--              tops, and re-run; the migration is idempotent.
--
-- Matching:    ILIKE patterns against home_services.name rather than a fixed
--              code list, because task8 generated names like 'Glycosylated Hb
--              (HbA1C)' and 'Coombs Test - Direct (DCT)'. A test that matches
--              no pattern deliberately gets no row -- it surfaces in the
--              existing "no tube" path for manual review instead of being
--              guessed at and drawn into the wrong additive.
-- Date: 2026-09-04
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- SECTION 1: CONTAINER TYPES
-- ----------------------------------------------------------------------------
INSERT INTO tube_types (code, name, cap_colour, additive, typical_volume_ml) VALUES
 ('esr_black',           'ESR (Black)',            'black',  'Sodium citrate 3.8%',  1.6),
 ('heparin_green',       'Heparin (Green)',        'green',  'Lithium heparin',      4.0),
 ('blood_culture_bottle','Blood Culture Bottle',   'navy',   'Culture broth',       10.0),
 ('urine_container',     'Urine Container',        'yellow', 'None (sterile)',      50.0),
 ('swab_container',      'Swab Transport Tube',    'white',  'Viral/bacterial transport medium', 3.0)
ON CONFLICT (code) DO NOTHING;

-- Mirror into the phlebotomist kit so stock tracking and the dashboard widget
-- can count them. urine_container already exists from phlebo_stock.sql.
INSERT INTO kit_items (code, name, category, cap_colour, decrement_event) VALUES
 ('esr_black',           'ESR (Black)',          'tube',      'black', 'per_tube'),
 ('heparin_green',       'Heparin (Green)',      'tube',      'green', 'per_tube'),
 ('blood_culture_bottle','Blood Culture Bottle', 'container', 'navy',  'per_tube'),
 ('swab_container',      'Swab Transport Tube',  'container', 'white', 'per_tube')
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- SECTION 2: TEST -> TUBE MAPPING
-- ----------------------------------------------------------------------------
-- A service already carrying a row for a given tube is skipped, so this is
-- safe to re-run and never disturbs task1's ten.
WITH serum AS (SELECT 'sst_gold'::text AS tube),        -- <- the one knob
patterns(tube, volume_ml, pattern) AS (VALUES
    -- ══ EDTA (Lavender) — whole-blood haematology ═══════════════════════════
    ('edta_lavender', 3.0, '%complete blood count%'),
    ('edta_lavender', 3.0, '%cbc%'),
    ('edta_lavender', 3.0, '%cbp%'),
    ('edta_lavender', 3.0, '%haemogram%'),
    ('edta_lavender', 3.0, '%hemogram%'),
    ('edta_lavender', 3.0, '%haemoglobin%'),
    ('edta_lavender', 3.0, '%hemoglobin%'),
    ('edta_lavender', 3.0, '%total leucocyte%'),
    ('edta_lavender', 3.0, '%total leukocyte%'),
    ('edta_lavender', 3.0, '%wbc%'),
    ('edta_lavender', 3.0, '%platelet%'),
    ('edta_lavender', 3.0, '%differential%count%'),
    ('edta_lavender', 3.0, '%peripheral smear%'),
    ('edta_lavender', 3.0, '%peripheral blood smear%'),
    ('edta_lavender', 3.0, '%reticulocyte%'),
    ('edta_lavender', 3.0, '%hba1c%'),
    ('edta_lavender', 3.0, '%glycosylated%'),
    ('edta_lavender', 3.0, '%glycated%'),
    ('edta_lavender', 3.0, '%absolute eosinophil%'),
    ('edta_lavender', 3.0, '%absolute lymphocyte%'),
    ('edta_lavender', 3.0, '%absolute monocyte%'),
    ('edta_lavender', 3.0, '%absolute neutrophil%'),
    ('edta_lavender', 3.0, '%malaria%'),
    ('edta_lavender', 3.0, '%blood group%'),
    ('edta_lavender', 3.0, '%rh typing%'),
    ('edta_lavender', 3.0, '%coombs%'),

    -- ══ ESR (Black) ═════════════════════════════════════════════════════════
    ('esr_black', 1.6, '%erythrocyte sedimentation%'),

    -- ══ Citrate (Light blue) — coagulation ══════════════════════════════════
    ('citrate_blue', 2.7, '%prothrombin%'),
    ('citrate_blue', 2.7, '%inr%'),
    ('citrate_blue', 2.7, '%partial thromboplastin%'),
    ('citrate_blue', 2.7, '%aptt%'),
    ('citrate_blue', 2.7, '%fibrinogen%'),
    ('citrate_blue', 2.7, '%d-dimer%'),
    ('citrate_blue', 2.7, '%d dimer%'),
    ('citrate_blue', 2.7, '%thrombin time%'),
    ('citrate_blue', 2.7, '%factor % assay%'),
    ('citrate_blue', 2.7, '%protein c%'),
    ('citrate_blue', 2.7, '%protein s%'),
    ('citrate_blue', 2.7, '%lupus anticoagulant%'),

    -- ══ Fluoride (Grey) — glycolysis inhibited glucose ══════════════════════
    ('fluoride_grey', 2.0, '%glucose%'),
    ('fluoride_grey', 2.0, '%sugar%'),
    ('fluoride_grey', 2.0, '%gtt%'),
    ('fluoride_grey', 2.0, '%tolerance test%'),

    -- ══ Heparin (Green) — plasma chemistry that will not wait ═══════════════
    ('heparin_green', 4.0, '%ammonia%'),
    ('heparin_green', 4.0, '%lactate%'),
    ('heparin_green', 4.0, '%blood gas%'),
    ('heparin_green', 4.0, '%abg%'),
    ('heparin_green', 4.0, '%ionized calcium%'),
    ('heparin_green', 4.0, '%ionised calcium%'),
    ('heparin_green', 4.0, '%troponin%'),

    -- ══ Blood culture bottle ════════════════════════════════════════════════
    ('blood_culture_bottle', 10.0, '%blood culture%'),

    -- ══ Urine container ═════════════════════════════════════════════════════
    ('urine_container', 50.0, '%urine%'),
    ('urine_container', 50.0, '%pregnancy test%'),

    -- ══ Swab transport tube ═════════════════════════════════════════════════
    ('swab_container', 3.0, '%swab%'),
    ('swab_container', 3.0, '%covid%'),
    ('swab_container', 3.0, '%sars-cov%'),
    ('swab_container', 3.0, '%influenza%'),
    ('swab_container', 3.0, '%rsv%'),
    ('swab_container', 3.0, '%respiratory syncytial%'),
    ('swab_container', 3.0, '%hpv%'),
    ('swab_container', 3.0, '%human papilloma%'),
    ('swab_container', 3.0, '%mrsa%'),
    ('swab_container', 3.0, '%chlamydia%'),
    ('swab_container', 3.0, '%gonorrh%'),

    -- ══ Serum — everything listed under red/gold ════════════════════════════
    ('__serum__', 5.0, '%liver function%'),
    ('__serum__', 5.0, '%lft%'),
    ('__serum__', 5.0, '%kidney function%'),
    ('__serum__', 5.0, '%renal function%'),
    ('__serum__', 5.0, '%kft%'),
    ('__serum__', 5.0, '%rft%'),
    ('__serum__', 5.0, '%lipid%'),
    ('__serum__', 5.0, '%cholesterol%'),
    ('__serum__', 5.0, '%triglyceride%'),
    ('__serum__', 5.0, '%uric acid%'),
    ('__serum__', 5.0, '%calcium%'),
    ('__serum__', 5.0, '%phosphorus%'),
    ('__serum__', 5.0, '%magnesium%'),
    ('__serum__', 5.0, '%iron%'),
    ('__serum__', 5.0, '%tibc%'),
    ('__serum__', 5.0, '%ferritin%'),
    ('__serum__', 5.0, '%vitamin%'),
    ('__serum__', 5.0, '%thyroid%'),
    ('__serum__', 5.0, '%tsh%'),
    ('__serum__', 5.0, '% t3%'),
    ('__serum__', 5.0, '% t4%'),
    ('__serum__', 5.0, '%fsh%'),
    ('__serum__', 5.0, '%luteinizing%'),
    ('__serum__', 5.0, '%prolactin%'),
    ('__serum__', 5.0, '%testosterone%'),
    ('__serum__', 5.0, '%estradiol%'),
    ('__serum__', 5.0, '%oestradiol%'),
    ('__serum__', 5.0, '%progesterone%'),
    ('__serum__', 5.0, '%cortisol%'),
    ('__serum__', 5.0, '%insulin%'),
    ('__serum__', 5.0, '%amylase%'),
    ('__serum__', 5.0, '%lipase%'),
    ('__serum__', 5.0, '%c-reactive%'),
    ('__serum__', 5.0, '%c reactive%'),
    ('__serum__', 5.0, '%antistreptolysin%'),
    ('__serum__', 5.0, '%ra factor%'),
    ('__serum__', 5.0, '%rheumatoid%'),
    ('__serum__', 5.0, '%antinuclear%'),
    ('__serum__', 5.0, '%hbsag%'),
    ('__serum__', 5.0, '%hepatitis%'),
    ('__serum__', 5.0, '%hiv%'),
    ('__serum__', 5.0, '%hcv%'),
    ('__serum__', 5.0, '%bilirubin%'),
    ('__serum__', 5.0, '%albumin%'),
    ('__serum__', 5.0, '%creatinine%'),
    ('__serum__', 5.0, '%urea%'),
    ('__serum__', 5.0, '%electrolyte%'),
    ('__serum__', 5.0, '%sodium%'),
    ('__serum__', 5.0, '%potassium%'),
    ('__serum__', 5.0, '%sgot%'),
    ('__serum__', 5.0, '%sgpt%'),
    ('__serum__', 5.0, '%alkaline phosphatase%'),
    -- Named-specimen serology and immunoassay. A test whose own name ends
    -- ", Serum" is a serum draw by definition; antibody/antigen/immunoglobulin
    -- work is the same tube. Section 2b below strips any of these that turn
    -- out to be a body fluid rather than blood.
    ('__serum__', 5.0, '%, serum%'),
    ('__serum__', 5.0, '%antibod%'),
    ('__serum__', 5.0, '%antigen%'),
    ('__serum__', 5.0, '%anti %'),
    ('__serum__', 5.0, '%immunoglobulin%'),
    ('__serum__', 5.0, '%igg%'),
    ('__serum__', 5.0, '%igm%'),
    ('__serum__', 5.0, '%ige%'),
    ('__serum__', 5.0, '%iga%'),
    ('__serum__', 5.0, '%hormone%'),
    ('__serum__', 5.0, '%peptide%'),
    ('__serum__', 5.0, '%apolipoprotein%'),
    ('__serum__', 5.0, '%microglobulin%'),
    ('__serum__', 5.0, '%feto protein%'),
    ('__serum__', 5.0, '%hcg%'),
    ('__serum__', 5.0, '%profile%'),
    ('__serum__', 5.0, '%enzyme%')
)
INSERT INTO home_service_tubes (home_service_id, tube_type_code, volume_ml)
SELECT DISTINCT ON (hs.id, resolved.tube) hs.id, resolved.tube, p.volume_ml
  FROM home_services hs
  JOIN patterns p ON hs.name ILIKE p.pattern
  CROSS JOIN LATERAL (
      SELECT CASE WHEN p.tube = '__serum__' THEN (SELECT tube FROM serum)
                  ELSE p.tube END AS tube
  ) resolved
 WHERE hs.service_kind = 'blood_test'
   AND NOT EXISTS (
        SELECT 1 FROM home_service_tubes t
         WHERE t.home_service_id = hs.id
           AND t.tube_type_code = resolved.tube
   )
ON CONFLICT (home_service_id, tube_type_code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- SECTION 2b: NON-VENIPUNCTURE SPECIMENS
-- ----------------------------------------------------------------------------
-- CSF, pleural/ascitic/synovial/pericardial/peritoneal fluid, sputum, biopsy,
-- pus and aspirates are not drawn from a vein. A home phlebotomist cannot
-- collect them -- they need a clinician and a procedure -- so handing them a
-- tube colour for one would be actively wrong. Strip any pattern match and
-- leave them tubeless, which is exactly the "no tube on file" state the
-- collector's widget flags for a call to the centre.
--
-- Deliberately NOT stripped: '..., Serum' and '..., Plasma', which ARE blood.
DELETE FROM home_service_tubes t
 USING home_services hs
 WHERE t.home_service_id = hs.id
   AND (
        hs.name ILIKE '%csf%'
     OR hs.name ILIKE '%pleural%'
     OR hs.name ILIKE '%ascitic%'
     OR hs.name ILIKE '%synovial%'
     OR hs.name ILIKE '%pericardial%'
     OR hs.name ILIKE '%peritoneal%'
     OR hs.name ILIKE '%aspirat%'
     OR hs.name ILIKE '%biopsy%'
     OR hs.name ILIKE '%sputum%'
     OR hs.name ILIKE '%stool%'
     OR hs.name ILIKE '%semen%'
     OR hs.name ILIKE '%bone marrow%'
     OR hs.name ILIKE '%amniotic%'
     OR hs.name ILIKE '%, pus%'
     -- Leading space required: '%pus %' also matched 'Lupus Anticoagulants',
     -- stripping the citrate tube off a real coagulation blood test.
     OR hs.name ILIKE '% pus%'
   );

-- ----------------------------------------------------------------------------
-- SECTION 3: CORRECT ESR
-- ----------------------------------------------------------------------------
-- task1 put ESR in a coagulation blue-top. Move it to the black ESR tube,
-- but only for services whose name is genuinely ESR-only: a combined
-- 'CBP WITH ESR' keeps its EDTA row and gains a black one from Section 2.
DELETE FROM home_service_tubes t
 USING home_services hs
 WHERE t.home_service_id = hs.id
   AND t.tube_type_code = 'citrate_blue'
   AND hs.name ILIKE '%erythrocyte sedimentation%';

DELETE FROM home_service_tubes t
 WHERE t.tube_type_code = 'citrate_blue'
   AND t.home_service_id IN (SELECT id FROM home_services WHERE code = 'ESR');

INSERT INTO home_service_tubes (home_service_id, tube_type_code, volume_ml)
SELECT hs.id, 'esr_black', 1.6
  FROM home_services hs
 WHERE hs.code = 'ESR'
   AND NOT EXISTS (
        SELECT 1 FROM home_service_tubes t
         WHERE t.home_service_id = hs.id AND t.tube_type_code = 'esr_black'
   );

INSERT INTO schema_migrations (filename, applied_by, notes)
VALUES (
    'task12_tube_requirements_full_catalog.sql',
    'claude',
    'Tube/container requirements for the full lab catalog; adds black ESR, '
    'green heparin, blood culture, urine and swab containers; corrects ESR '
    'from citrate blue to black.'
)
ON CONFLICT (filename) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ----------------------------------------------------------------------------
-- How many bookable blood tests still have no tube? (was ~498)
--   SELECT count(*) FROM home_services hs
--    WHERE hs.service_kind = 'blood_test' AND hs.is_active
--      AND NOT EXISTS (SELECT 1 FROM home_service_tubes t
--                       WHERE t.home_service_id = hs.id);
--
-- Which ones, so they can be mapped by hand?
--   SELECT hs.code, hs.name FROM home_services hs
--    WHERE hs.service_kind = 'blood_test' AND hs.is_active
--      AND NOT EXISTS (SELECT 1 FROM home_service_tubes t
--                       WHERE t.home_service_id = hs.id)
--    ORDER BY hs.name;
--
-- Spot-check the tube mix for one test:
--   SELECT hs.name, t.tube_type_code, tt.cap_colour, t.volume_ml
--     FROM home_services hs
--     JOIN home_service_tubes t ON t.home_service_id = hs.id
--     JOIN tube_types tt ON tt.code = t.tube_type_code
--    WHERE hs.name ILIKE '%complete blood count%';

-- ----------------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DELETE FROM home_service_tubes
--  WHERE tube_type_code IN ('esr_black','heparin_green','blood_culture_bottle',
--                           'urine_container','swab_container');
-- DELETE FROM home_service_tubes t USING home_services hs
--  WHERE t.home_service_id = hs.id
--    AND hs.code NOT IN ('CBC','LFT','KFT','LIPID','HBA1C','THYROID',
--                        'VITD','VITB12','ESR','CRP');
-- INSERT INTO home_service_tubes (home_service_id, tube_type_code, volume_ml)
-- SELECT id, 'citrate_blue', 2.7 FROM home_services WHERE code = 'ESR'
--  ON CONFLICT DO NOTHING;
-- DELETE FROM kit_items WHERE code IN ('esr_black','heparin_green',
--                                      'blood_culture_bottle','swab_container');
-- DELETE FROM tube_types WHERE code IN ('esr_black','heparin_green',
--                                       'blood_culture_bottle','swab_container');
-- DELETE FROM schema_migrations WHERE filename = 'task12_tube_requirements_full_catalog.sql';
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
