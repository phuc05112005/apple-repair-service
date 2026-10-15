-- Apply once to an existing database before running with ddl-auto=validate.
-- Adds optional origin (nơi xuất xứ) and manufacturer (nhà sản xuất) to parts.
-- Existing rows keep NULL; no data is modified or removed.
ALTER TABLE parts
  ADD COLUMN manufacturer varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER created_at,
  ADD COLUMN origin varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER name;
