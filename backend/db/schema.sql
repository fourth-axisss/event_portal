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
    CONSTRAINT uq_clubs_id_fest UNIQUE (id, fest_id),
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






-- ---------------------------------------------------------
-- GROUP 4: EVENTS
-- ---------------------------------------------------------

CREATE TABLE events (
  id                     INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  kind                   ENUM('normal', 'umbrella') NOT NULL DEFAULT 'normal',
  scope                  ENUM('single_club', 'multi_club', 'fest', 'faculty') NOT NULL,
  event_type_id          INT UNSIGNED      NULL,
  fest_id                INT UNSIGNED      NULL,
  club_id                INT UNSIGNED      NULL,
  parent_event_id        INT UNSIGNED      NULL,
  created_by             INT UNSIGNED      NOT NULL,
  title                  VARCHAR(150)      NOT NULL,
  description            TEXT              NULL,
  venue_id               INT UNSIGNED      NULL,
  start_time             DATETIME          NOT NULL,
  end_time               DATETIME          NOT NULL,
  registration_required  TINYINT(1)        NOT NULL DEFAULT 1,
  registration_deadline  DATETIME          NULL,
  capacity               INT UNSIGNED      NULL,
  fee                    DECIMAL(8, 2)     NOT NULL DEFAULT 0.00,
  auto_approve           TINYINT(1)        NOT NULL DEFAULT 1,
  is_team_event          TINYINT(1)        NOT NULL DEFAULT 0,
  team_min               TINYINT UNSIGNED  NULL,
  team_max               TINYINT UNSIGNED  NULL,
  open_to_externals      TINYINT(1)        NOT NULL DEFAULT 0,
  certificate_criteria   ENUM('none', 'attendance', 'completion') NOT NULL DEFAULT 'attendance',
    min_attendance_percent TINYINT UNSIGNED  NOT NULL DEFAULT 75,
  poster_path            VARCHAR(255)      NULL,
  status                 ENUM('draft', 'published', 'cancelled') NOT NULL DEFAULT 'draft',
  cancel_reason          VARCHAR(500)      NULL,
  created_at             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_events_id_fest UNIQUE (id, fest_id),
  INDEX idx_events_status_start (status, start_time),

  -- simple foreign keys (no ON DELETE written = NO ACTION = behaves as RESTRICT)
  CONSTRAINT fk_events_type       FOREIGN KEY (event_type_id) REFERENCES event_types (id),
  CONSTRAINT fk_events_fest       FOREIGN KEY (fest_id)       REFERENCES fests (id),
  CONSTRAINT fk_events_venue      FOREIGN KEY (venue_id)      REFERENCES venues (id),
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by)    REFERENCES users (id),

  -- composite foreign keys (cross-table rules)
  CONSTRAINT fk_events_club_fest
    FOREIGN KEY (club_id, fest_id) REFERENCES clubs (id, fest_id),
  CONSTRAINT fk_events_parent_same_fest
    FOREIGN KEY (parent_event_id, fest_id) REFERENCES events (id, fest_id),

  -- row rules
    CONSTRAINT chk_events_min_attendance CHECK (min_attendance_percent BETWEEN 1 AND 100),
  CONSTRAINT chk_events_scope CHECK (
       (scope = 'faculty'     AND fest_id IS NULL     AND club_id IS NULL)
    OR (scope = 'single_club' AND fest_id IS NOT NULL AND club_id IS NOT NULL)
    OR (scope IN ('multi_club', 'fest') AND fest_id IS NOT NULL AND club_id IS NULL)
  ),
  CONSTRAINT chk_events_type_required CHECK (kind = 'umbrella' OR event_type_id IS NOT NULL),
  CONSTRAINT chk_events_umbrella CHECK (
       kind = 'normal'
    OR (scope = 'fest' AND parent_event_id IS NULL
        AND event_type_id IS NULL AND registration_required = 0)
  ),
  CONSTRAINT chk_events_parent CHECK (
       parent_event_id IS NULL OR (kind = 'normal' AND scope <> 'faculty')
  ),
  CONSTRAINT chk_events_registration CHECK (
       (registration_required = 1 AND registration_deadline IS NOT NULL
                                  AND registration_deadline <= end_time)
    OR (registration_required = 0 AND registration_deadline IS NULL
        AND capacity IS NULL AND fee = 0 AND is_team_event = 0
        AND certificate_criteria = 'none' AND open_to_externals = 0)
  ),
  CONSTRAINT chk_events_time      CHECK (end_time > start_time),
  CONSTRAINT chk_events_capacity  CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT chk_events_fee       CHECK (fee >= 0),
  CONSTRAINT chk_events_team CHECK (
       (is_team_event = 0 AND team_min IS NULL AND team_max IS NULL)
    OR (is_team_event = 1 AND team_min IS NOT NULL AND team_max IS NOT NULL
        AND team_min >= 1 AND team_max >= team_min)
  ),
  CONSTRAINT chk_events_externals CHECK (open_to_externals = 0 OR scope = 'fest'),
  CONSTRAINT chk_events_bools CHECK (
        registration_required IN (0, 1) AND auto_approve IN (0, 1)
    AND is_team_event IN (0, 1)         AND open_to_externals IN (0, 1)
  )
) ENGINE=InnoDB;

CREATE TABLE event_clubs (
  event_id  INT UNSIGNED NOT NULL,
  fest_id   INT UNSIGNED NOT NULL,
  club_id   INT UNSIGNED NOT NULL,
  PRIMARY KEY (event_id, club_id),
  CONSTRAINT fk_event_clubs_event
    FOREIGN KEY (event_id, fest_id) REFERENCES events (id, fest_id) ON DELETE CASCADE,
  CONSTRAINT fk_event_clubs_club
    FOREIGN KEY (club_id, fest_id)  REFERENCES clubs (id, fest_id)
) ENGINE=InnoDB;

CREATE TABLE event_eligibility (
  event_id  INT UNSIGNED NOT NULL,
  program   ENUM('UG', 'DD', 'PG', 'PHD') NOT NULL,
  year      TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (event_id, program, year),
  CONSTRAINT fk_event_eligibility_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT chk_event_eligibility_year CHECK (
       (program = 'UG'  AND year BETWEEN 1 AND 4)
    OR (program = 'DD'  AND year BETWEEN 1 AND 5)
    OR (program = 'PG'  AND year BETWEEN 1 AND 2)
    OR (program = 'PHD' AND year BETWEEN 1 AND 5)
  )
) ENGINE=InnoDB;

CREATE TABLE event_eligible_departments (
  event_id       INT UNSIGNED NOT NULL,
  department_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (event_id, department_id),
  CONSTRAINT fk_eed_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_eed_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB;

CREATE TABLE event_files (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  event_id       INT UNSIGNED  NOT NULL,
  title          VARCHAR(150)  NOT NULL,
  stored_name    VARCHAR(255)  NOT NULL,
  original_name  VARCHAR(255)  NOT NULL,
  mime_type      VARCHAR(100)  NOT NULL,
  size_bytes     INT UNSIGNED  NOT NULL,
  uploaded_by    INT UNSIGNED  NOT NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_event_files_stored_name UNIQUE (stored_name),
  CONSTRAINT fk_event_files_event
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_event_files_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users (id),
  CONSTRAINT chk_event_files_size CHECK (size_bytes > 0)
) ENGINE=InnoDB;

-- Lifecycle computed at read time (never stored, never stale)
CREATE VIEW v_events AS
SELECT e.*,
  CASE
    WHEN e.status = 'draft'                THEN 'draft'
    WHEN e.status = 'cancelled'            THEN 'cancelled'
    WHEN NOW() >= e.end_time               THEN 'completed'
    WHEN NOW() >= e.start_time             THEN 'ongoing'
    WHEN e.registration_required = 1
         AND NOW() > e.registration_deadline THEN 'registration_closed'
    WHEN e.registration_required = 1       THEN 'registration_open'
    ELSE 'upcoming'
  END AS lifecycle
FROM events e;




-- ---------------------------------------------------------
-- GROUP 5: REGISTRATIONS & PAYMENTS
-- ---------------------------------------------------------

CREATE TABLE registrations (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  event_id          INT UNSIGNED  NOT NULL,
  user_id           INT UNSIGNED  NOT NULL,
  status            ENUM('pending', 'approved', 'confirmed', 'rejected', 'cancelled') NOT NULL,
  rejection_reason  VARCHAR(500)  NULL,
  decided_by        INT UNSIGNED  NULL,
  decided_at        DATETIME      NULL,
    completed             TINYINT(1)    NOT NULL DEFAULT 0,
  completion_marked_by  INT UNSIGNED  NULL,
  completion_marked_at  DATETIME      NULL,
  registered_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_registrations_event_user UNIQUE (event_id, user_id),
    CONSTRAINT uq_registrations_id_event UNIQUE (id, event_id),
  INDEX idx_registrations_user_status (user_id, status),
  CONSTRAINT fk_registrations_event      FOREIGN KEY (event_id)   REFERENCES events (id),
  CONSTRAINT fk_registrations_user       FOREIGN KEY (user_id)    REFERENCES users (id),
  CONSTRAINT fk_registrations_decided_by FOREIGN KEY (decided_by) REFERENCES users (id),
  CONSTRAINT chk_registrations_rejection CHECK (
       (status = 'rejected'  AND rejection_reason IS NOT NULL AND decided_by IS NOT NULL)
    OR (status <> 'rejected' AND rejection_reason IS NULL)
  ),
  CONSTRAINT chk_registrations_decision CHECK (
       (decided_by IS NULL     AND decided_at IS NULL)
    OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)
  ),
    CONSTRAINT fk_registrations_completion_by FOREIGN KEY (completion_marked_by) REFERENCES users (id),
  CONSTRAINT chk_registrations_completion CHECK (
       (completed = 0 AND completion_marked_by IS NULL AND completion_marked_at IS NULL)
    OR (completed = 1 AND completion_marked_by IS NOT NULL AND completion_marked_at IS NOT NULL
        AND status = 'confirmed')
  )
) ENGINE=InnoDB;

CREATE TABLE payments (
  id                    INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  registration_id       INT UNSIGNED   NOT NULL,
  organizer_id          INT UNSIGNED   NOT NULL,
  amount                DECIMAL(8, 2)  NOT NULL,
  status                ENUM('created', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'created',
  provider              ENUM('simulated', 'razorpay') NOT NULL DEFAULT 'simulated',
  provider_order_id     VARCHAR(100)   NOT NULL,
  provider_payment_id   VARCHAR(100)   NULL,
  paid_registration_id  INT UNSIGNED
      GENERATED ALWAYS AS (CASE WHEN status = 'paid' THEN registration_id END) STORED,
  created_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at               DATETIME       NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_payments_order    UNIQUE (provider_order_id),
  CONSTRAINT uq_payments_one_paid UNIQUE (paid_registration_id),
  CONSTRAINT fk_payments_registration FOREIGN KEY (registration_id) REFERENCES registrations (id),
  CONSTRAINT fk_payments_organizer    FOREIGN KEY (organizer_id)    REFERENCES users (id),
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  CONSTRAINT chk_payments_status CHECK (
       (status IN ('paid', 'refunded') AND paid_at IS NOT NULL AND provider_payment_id IS NOT NULL)
    OR (status IN ('created', 'failed') AND paid_at IS NULL)
  )
) ENGINE=InnoDB;