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



-- ---------------------------------------------------------
-- GROUP 3: USERS & ORGANISATION
-- ---------------------------------------------------------

CREATE TABLE users (
  id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  role           ENUM('student', 'faculty', 'admin') NOT NULL,
  name           VARCHAR(100)      NOT NULL,
  email          VARCHAR(150)      NOT NULL,
  password_hash  CHAR(60)          NOT NULL,
  roll_no        VARCHAR(20)       NULL,
  department_id  INT UNSIGNED      NULL,
  program        ENUM('UG', 'DD', 'PG', 'PHD') NULL,
  year           TINYINT UNSIGNED  NULL,
  phone          VARCHAR(15)       NULL,
  is_active      TINYINT(1)        NOT NULL DEFAULT 1,
  created_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_users_email   UNIQUE (email),
  CONSTRAINT uq_users_roll_no UNIQUE (roll_no),
  CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_users_active CHECK (is_active IN (0, 1)),
  CONSTRAINT chk_users_student_fields CHECK (
       (role = 'student'  AND roll_no IS NOT NULL AND department_id IS NOT NULL
                          AND program IS NOT NULL AND year IS NOT NULL)
    OR (role <> 'student' AND roll_no IS NULL AND program IS NULL AND year IS NULL)
  ),
  CONSTRAINT chk_users_program_year CHECK (
       year IS NULL
    OR (program = 'UG'  AND year BETWEEN 1 AND 4)
    OR (program = 'DD'  AND year BETWEEN 1 AND 5)
    OR (program = 'PG'  AND year BETWEEN 1 AND 2)
    OR (program = 'PHD' AND year BETWEEN 1 AND 5)
  )
) ENGINE=InnoDB;

CREATE TABLE fests (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name             VARCHAR(60)   NOT NULL,
  description      VARCHAR(500)  NULL,
  logo_path        VARCHAR(255)  NULL,
  signatory_name   VARCHAR(100)  NULL,
  signatory_title  VARCHAR(100)  NULL,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_fests_name    UNIQUE (name),
  CONSTRAINT chk_fests_active CHECK (is_active IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE clubs (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  fest_id          INT UNSIGNED  NOT NULL,
  name             VARCHAR(100)  NOT NULL,
  description      VARCHAR(500)  NULL,
  logo_path        VARCHAR(255)  NULL,
  signatory_name   VARCHAR(100)  NULL,
  signatory_title  VARCHAR(100)  NULL,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_clubs_name UNIQUE (name),
  CONSTRAINT fk_clubs_fest
    FOREIGN KEY (fest_id) REFERENCES fests (id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_clubs_active CHECK (is_active IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE positions (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED  NOT NULL,
  position_type  ENUM('fest_head', 'gsec', 'fest_event_creator', 'club_coordinator') NOT NULL,
  fest_id        INT UNSIGNED  NULL,
  club_id        INT UNSIGNED  NULL,
  scope_id       INT UNSIGNED  GENERATED ALWAYS AS (COALESCE(club_id, fest_id)) STORED,
  granted_by     INT UNSIGNED  NOT NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_positions_user_scope UNIQUE (user_id, position_type, scope_id),
  CONSTRAINT fk_positions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_positions_fest
    FOREIGN KEY (fest_id) REFERENCES fests (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_positions_club
    FOREIGN KEY (club_id) REFERENCES clubs (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_positions_granted_by
    FOREIGN KEY (granted_by) REFERENCES users (id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_positions_scope CHECK (
       (position_type IN ('fest_head', 'gsec', 'fest_event_creator')
          AND fest_id IS NOT NULL AND club_id IS NULL)
    OR (position_type = 'club_coordinator'
          AND club_id IS NOT NULL AND fest_id IS NULL)
  )
) ENGINE=InnoDB;