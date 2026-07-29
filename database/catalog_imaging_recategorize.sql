-- ============================================================
-- catalog_imaging_recategorize.sql
-- Idempotent: UPDATEs service_catalog rows where category was
-- incorrectly set to 'lab_test' but the name clearly indicates
-- an imaging / radiology service.
-- Safe to run multiple times — WHERE guards re-check UPPER(name)
-- and category='lab_test' so already-correct rows are unchanged.
-- ============================================================

-- MRI scans — expected ~15-25
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'mri'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'MRI%';

-- CT scans — expected ~10-20
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ct_scan'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'CT %';

-- X-Ray (X-RAY prefix) — expected ~8-15
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'xray'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'X-RAY%';

-- X-Ray (XRAY prefix without hyphen) — expected ~2-5
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'xray'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'XRAY%';

-- Ultrasound / USG — expected ~10-20
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ultrasound'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'USG%';

-- Ultrasound (full name) — expected ~3-8
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ultrasound'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'ULTRASOUND%';

-- ECG — expected ~5-10
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ecg_echo'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'ECG%';

-- Echo — expected ~3-6
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ecg_echo'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'ECHO%';

-- DEXA / Bone density — expected ~2-4
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'dexa'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'DEXA%';

-- Mammography — expected ~2-4
UPDATE service_catalog
SET category = 'imaging'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'MAMMOGRAPHY%';

-- Sonography — expected ~2-5
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ultrasound'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'SONOGRAPHY%';

-- Doppler — expected ~3-6
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ultrasound'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'DOPPLER%';

-- TMT (Treadmill Test) — expected ~1-3
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ecg_echo'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'TMT%';

-- Holter monitoring — expected ~1-2
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ecg_echo'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'HOLTER%';

-- PFT (Pulmonary Function Test) — expected ~1-3
UPDATE service_catalog
SET category = 'imaging'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'PFT%';

-- Audiometry — expected ~1-3
UPDATE service_catalog
SET category = 'imaging'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'AUDIOMETRY%';

-- BMD (Bone Mineral Density) — expected ~1-3
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'dexa'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'BMD%';

-- PET-CT — expected ~1-3
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ct_scan'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'PET-CT%';

-- TIFFA (Targeted Imaging for Fetal Anomaly) — expected ~1-2
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ultrasound'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'TIFFA%';

-- NT Scan (Nuchal Translucency) — expected ~1-2
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ultrasound'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'NT SCAN%';

-- Anomaly scan — expected ~1-2
UPDATE service_catalog
SET category = 'imaging',
    sub_category = 'ultrasound'
WHERE category = 'lab_test'
  AND UPPER(name) LIKE 'ANOMALY%';