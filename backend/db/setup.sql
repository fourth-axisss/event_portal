-- =========================================================
-- setup.sql  —  run ONCE, as root, in MySQL Workbench
-- Creates the project database and the restricted app user.
-- The real password is typed only in Workbench, never saved here.
-- =========================================================

-- 1. The database (container for all our tables)
CREATE DATABASE IF NOT EXISTS event_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- 2. The app's own MySQL account (only from this computer)
CREATE USER IF NOT EXISTS 'event_app'@'localhost'
  IDENTIFIED BY 'Dracarys';

-- 3. Give it ONLY row-level (DML) rights, ONLY on event_portal
GRANT SELECT, INSERT, UPDATE, DELETE
  ON event_portal.*
  TO 'event_app'@'localhost';

-- 4. Check what we granted
SHOW GRANTS FOR 'event_app'@'localhost';