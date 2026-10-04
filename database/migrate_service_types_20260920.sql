-- Run against an existing database after confirming there are no business references
-- to INSPECTION catalog rows. Keep foreign-key checks enabled.
START TRANSACTION;

-- Preflight: both counts must be zero. Stop without applying the statements below
-- if either count is nonzero.
SELECT COUNT(*) AS appointment_references
FROM appointment_service_items a
JOIN service_catalog_items c ON c.id = a.service_catalog_item_id
JOIN service_types t ON t.id = c.service_type_id
WHERE t.code = 'INSPECTION';
SELECT COUNT(*) AS repair_references
FROM repair_items r
JOIN service_catalog_items c ON c.id = r.service_catalog_item_id
JOIN service_types t ON t.id = c.service_type_id
WHERE t.code = 'INSPECTION';

-- A warranty booking requires a persisted WARRANTY catalog item for the model
-- and issue of the covered service. No price is promised before inspection.
INSERT INTO service_catalog_items
  (configured_price, created_at, name, standard_duration_minutes, status,
   updated_at, warranty_days, device_model_id, part_id, service_issue_id, service_type_id)
SELECT NULL, NOW(6), 'Tiếp nhận bảo hành', 60, 'ACTIVE', NOW(6), 0,
       source.device_model_id, NULL, source.service_issue_id, warranty_type.id
FROM (
  SELECT DISTINCT c.device_model_id, c.service_issue_id
  FROM service_catalog_items c
  JOIN service_types t ON t.id = c.service_type_id
  WHERE t.code IN ('REPAIR', 'REPLACEMENT') AND c.status = 'ACTIVE' AND c.warranty_days > 0
) source
JOIN service_types warranty_type ON warranty_type.code = 'WARRANTY'
WHERE NOT EXISTS (
  SELECT 1 FROM service_catalog_items existing
  WHERE existing.device_model_id = source.device_model_id
    AND existing.service_issue_id = source.service_issue_id
    AND existing.service_type_id = warranty_type.id
);

DELETE c FROM service_catalog_items c
JOIN service_types t ON t.id = c.service_type_id
WHERE t.code = 'INSPECTION';
DELETE FROM service_types WHERE code = 'INSPECTION';
COMMIT;

ALTER TABLE service_types
  MODIFY code ENUM('REPAIR', 'REPLACEMENT', 'WARRANTY')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
