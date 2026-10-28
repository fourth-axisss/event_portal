-- =========================================================
-- schema.sql — all CREATE TABLE statements for event_portal
-- Run as ROOT (DDL). Built up group by group.
-- =========================================================
USE event_portal;

-- ---------------------------------------------------------
-- GROUP 2: MASTER DATA
-- ---------------------------------------------------------

CREATE TABLE departments (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  code        VARCHAR(10)   NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_departments_code   UNIQUE (code),
  CONSTRAINT uq_departments_name   UNIQUE (name),
  CONSTRAINT chk_departments_active CHECK (is_active IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE venues (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,
  capacity    INT UNSIGNED  NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_venues_name      UNIQUE (name),
  CONSTRAINT chk_venues_capacity CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT chk_venues_active   CHECK (is_active IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE event_types (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name              VARCHAR(60)   NOT NULL,
  organize_rule     ENUM('faculty', 'student', 'both') NOT NULL,
  participate_rule  ENUM('student', 'faculty', 'both') NOT NULL,
  clash_check       TINYINT(1)    NOT NULL DEFAULT 1,
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_event_types_name   UNIQUE (name),
  CONSTRAINT chk_event_types_clash  CHECK (clash_check IN (0, 1)),
  CONSTRAINT chk_event_types_active CHECK (is_active IN (0, 1))
) ENGINE=InnoDB;