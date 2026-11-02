-- =========================================================
-- 001: keep uploaded event files inside MySQL
-- Run ONCE on every database that already exists (your PC as root, and Aiven as avnadmin).
-- A fresh install from schema.sql already has this column.
-- =========================================================
USE event_portal;

ALTER TABLE event_files
  ADD COLUMN data LONGBLOB NULL AFTER size_bytes;

-- Check: the new column "data" appears after size_bytes
SHOW COLUMNS FROM event_files;
