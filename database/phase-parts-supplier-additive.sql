-- Apply once to an existing database before running with ddl-auto=validate.
-- Adds optional supplier information to parts without changing existing rows.
ALTER TABLE parts
  ADD COLUMN supplier varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER origin;
