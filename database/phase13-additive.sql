-- Apply ONCE to a Phase 1.2 schema after reviewing existing catalog data.
-- This file is not executed automatically against the user database.
ALTER TABLE `service_catalog_items`
  ADD COLUMN `warranty_remedy` enum('REPAIR','REPLACEMENT') DEFAULT NULL,
  ADD COLUMN `warranty_replacement_catalog_id` bigint DEFAULT NULL,
  ADD KEY `fk_service_catalog_warranty_replacement` (`warranty_replacement_catalog_id`),
  ADD CONSTRAINT `fk_service_catalog_warranty_replacement`
    FOREIGN KEY (`warranty_replacement_catalog_id`) REFERENCES `service_catalog_items` (`id`);

-- Resolve any legacy NULL standard duration deliberately before enabling this constraint.
-- No artificial 30-minute value is supplied by this migration.
ALTER TABLE `service_catalog_items`
  MODIFY COLUMN `standard_duration_minutes` int NOT NULL;
