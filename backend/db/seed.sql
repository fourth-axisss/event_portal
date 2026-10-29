-- =========================================================
-- seed.sql — dummy/demo data for event_portal
-- Run as ROOT, after schema.sql. Built up group by group.
-- =========================================================
USE event_portal;

-- ---------------------------------------------------------
-- GROUP 2: MASTER DATA
-- ---------------------------------------------------------

INSERT INTO departments (id, code, name) VALUES
  (1, 'CSE',  'Computer Science and Engineering'),
  (2, 'CCE',  'Communication and Computer Engineering'),
  (3, 'ECE',  'Electronics and Communication Engineering'),
  (4, 'ME',   'Mechanical-Mechatronics Engineering'),
  (5, 'MATH', 'Mathematics'),
  (6, 'PHY',  'Physics'),
  (7, 'HSS',  'Humanities and Social Sciences');

INSERT INTO venues (id, name, capacity) VALUES
  (1, 'Main Auditorium',   600),
  (2, 'LT-1',              180),
  (3, 'LT-2',              180),
  (4, 'LT-3',              120),
  (5, 'Seminar Hall',      100),
  (6, 'Computer Lab 1',     60),
  (7, 'Open Air Theatre',  800),
  (8, 'Football Ground',  NULL),
  (9, 'Basketball Court', NULL),
  (10, 'LT-10',            180),
  (11,  'LT-11',            180),
  (12,  'LT-16',            160),
  (13,  'LT-17',            160),
  (14,  'LT-18',            160),
  (15,  'Computer Lab 2',    80),
  (16,  'Computer Lab 3',   100),
  (17,  'Central Pallaso',  NULL),
  (18,  'Student Activity Center', NULL),
  (19,  'Canteen',          NULL);

INSERT INTO event_types (id, name, organize_rule, participate_rule, clash_check) VALUES
  (1,  'FDP',                 'faculty', 'faculty', 1),
  (2,  'Workshop',            'faculty', 'both',    1),
  (3,  'Seminar',             'faculty', 'both',    1),
  (4,  'Short-Term Training', 'faculty', 'both',    1),
  (5,  'Self-Paced Course',   'faculty', 'both',    0),
  (6,  'PG Certificate',      'faculty', 'both',    0),
  (7,  'Competition',         'both',    'student', 1),
  (8,  'Hackathon',           'both',    'student', 1),
  (9,  'Quiz',                'both',    'student', 1),
  (10, 'Cultural',            'both',    'student', 1),
  (11, 'Sports',              'student',  'student', 1),
  (12, 'Recuritememt',         'student',  'student',1);





  -- ---------------------------------------------------------
-- GROUP 3: USERS & ORGANISATION
-- All demo users have password: Password@123
-- ---------------------------------------------------------

SET @pw = '$2b$10$2Y7ebOh63GaB73gIHQRZ8.OAdQhUWoUV9FjBCSj3Z9I3DH4tPK7Ym';

INSERT INTO users (id, role, name, email, password_hash, roll_no, department_id, program, year) VALUES
  (1,  'admin',   'Portal Admin',      'admin@lnmiit.ac.in',         @pw, NULL,       NULL, NULL,  NULL),
  (2,  'faculty', 'Dr. Anil Mehta',    'anil.mehta@lnmiit.ac.in',    @pw, NULL,       1,    NULL,  NULL),
  (3,  'faculty', 'Dr. Kavita Sharma', 'kavita.sharma@lnmiit.ac.in', @pw, NULL,       3,    NULL,  NULL),
  (4,  'student', 'Riya Verma',        'riya@lnmiit.ac.in',          @pw, '25UCS101', 1,    'UG',  2),
  (5,  'student', 'Arjun Singh',       'arjun@lnmiit.ac.in',         @pw, '23UCS045', 1,    'UG',  4),
  (6,  'student', 'Kabir Jain',        'kabir@lnmiit.ac.in',         @pw, '24UEC032', 3,    'UG',  3),
  (7,  'student', 'Sneha Gupta',       'sneha@lnmiit.ac.in',         @pw, '24UCC017', 2,    'UG',  3),
  (8,  'student', 'Aman Yadav',        'aman@lnmiit.ac.in',          @pw, '25UME008', 4,    'UG',  2),
  (9,  'student', 'Vikram Rathore',    'vikram@lnmiit.ac.in',        @pw, '24UCS088', 1,    'UG',  3),
  (10, 'student', 'Ishita Kapoor',     'ishita@lnmiit.ac.in',        @pw, '25UCC054', 2,    'UG',  2),
  (11, 'student', 'Priya Nair',        'priya@lnmiit.ac.in',         @pw, '22DCS011', 1,    'DD',  5),
  (12, 'student', 'Rahul Meena',       'rahul@lnmiit.ac.in',         @pw, '26PCS003', 1,    'PG',  1),
  (13, 'student', 'Neha Agarwal',      'neha@lnmiit.ac.in',          @pw, '26UEC071', 3,    'UG',  1);

INSERT INTO fests (id, name, description) VALUES
  (1, 'Vivacity',    'Annual cultural fest'),
  (2, 'Desportivos', 'Annual sports fest'),
  (3, 'Plinth',      'Annual technical fest');

INSERT INTO clubs (id, fest_id, name) VALUES
  (1,  1, 'Music Club'),
  (2,  1, 'Dance Club'),
  (3,  1, 'Art Club'),
  (4,  1, 'Fashion Club'),
  (5,  2, 'Football Club'),
  (6,  2, 'Basketball Club'),
  (7,  2, 'Athletics Club'),
  (8,  3, 'Coding Club'),
  (9,  3, 'Robotics Club'),
  (10, 3, 'Astronomy Club');

-- position: user, type, fest OR club, granted by
INSERT INTO positions (id, user_id, position_type, fest_id, club_id, granted_by) VALUES
  (1, 5,  'fest_head',          3,    NULL, 1),   -- Arjun: Fest Head, Plinth (by admin)
  (2, 6,  'gsec',               3,    NULL, 1),   -- Kabir: GSec, Plinth (by admin)
  (3, 7,  'fest_head',          1,    NULL, 1),   -- Sneha: Fest Head, Vivacity (by admin)
  (4, 10, 'fest_event_creator', 3,    NULL, 5),   -- Ishita: FEC, Plinth (granted by Arjun)
  (5, 8,  'club_coordinator',   NULL, 1,    1),   -- Aman: Music Club Coordinator (by admin)
  (6, 9,  'club_coordinator',   NULL, 8,    1),   -- Vikram: Coding Club Coordinator (by admin)
  (7, 9,  'fest_event_creator', 3,    NULL, 6);   -- Vikram: also FEC, Plinth (granted by Kabir)






  -- ---------------------------------------------------------
-- GROUP 4: EVENTS
-- ---------------------------------------------------------

-- 1. Quantz: Plinth's umbrella (by Arjun, Fest Head of Plinth)
INSERT INTO events (id, kind, scope, fest_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, certificate_criteria, status)
VALUES (1, 'umbrella', 'fest', 3, 5, 'Quantz', 'Flagship 3-day tech carnival of Plinth', 7,
        '2026-11-14 09:00:00', '2026-11-16 22:00:00', 0, 'none', 'published');

-- 2. Plinth Hackathon: fest event inside Quantz (by Ishita, Fest Event Creator), team of 2-4, open to externals
INSERT INTO events (id, scope, event_type_id, fest_id, parent_event_id, created_by, title, venue_id,
                    start_time, end_time, registration_deadline, capacity,
                    is_team_event, team_min, team_max, open_to_externals, status)
VALUES (2, 'fest', 8, 3, 1, 10, 'Plinth Hackathon 2026', 16,
        '2026-11-14 10:00:00', '2026-11-15 10:00:00', '2026-11-12 23:59:59', 100,
        1, 2, 4, 1, 'published');

-- 3. Robowars: Robotics Club event inside Quantz (by Arjun), paid, team of 2-5
INSERT INTO events (id, scope, event_type_id, fest_id, club_id, parent_event_id, created_by, title, venue_id,
                    start_time, end_time, registration_deadline, capacity, fee,
                    is_team_event, team_min, team_max, status)
VALUES (3, 'single_club', 7, 3, 9, 1, 5, 'Robowars', 8,
        '2026-11-15 14:00:00', '2026-11-15 18:00:00', '2026-11-13 23:59:59', 40, 200.00,
        1, 2, 5, 'published');

-- 4. Music Club Recruitment: single-club, NEEDS APPROVAL (by Aman, Music Club Coordinator)
INSERT INTO events (id, scope, event_type_id, fest_id, club_id, created_by, title, venue_id,
                    start_time, end_time, registration_deadline, capacity, auto_approve, status)
VALUES (4, 'single_club', 12, 1, 1, 8, 'Music Club Recruitment', 18,
        '2026-11-05 17:00:00', '2026-11-05 20:00:00', '2026-11-03 23:59:59', 30, 0, 'published');

-- 5. Gusto: multi-club Vivacity event, no registration needed (by Sneha, Fest Head of Vivacity)
INSERT INTO events (id, scope, event_type_id, fest_id, created_by, title, venue_id,
                    start_time, end_time, registration_required, certificate_criteria, status)
VALUES (5, 'multi_club', 10, 1, 7, 'Gusto', 7,
        '2026-11-20 18:00:00', '2026-11-20 22:00:00', 0, 'none', 'published');

-- 6. FDP on Machine Learning: faculty event (by Dr. Mehta)
INSERT INTO events (id, scope, event_type_id, created_by, title, venue_id,
                    start_time, end_time, registration_deadline, capacity, status)
VALUES (6, 'faculty', 1, 2, 'FDP on Machine Learning', 5,
        '2026-11-10 09:30:00', '2026-11-10 17:30:00', '2026-11-08 23:59:59', 40, 'published');

-- 7. Git & GitHub Workshop: faculty event with eligibility (by Dr. Mehta). Overlaps Music Recruitment!
INSERT INTO events (id, scope, event_type_id, created_by, title, venue_id,
                    start_time, end_time, registration_deadline, capacity, status)
VALUES (7, 'faculty', 2, 2, 'Git & GitHub Workshop', 6,
        '2026-11-05 16:00:00', '2026-11-05 19:00:00', '2026-11-04 23:59:59', 60, 'published');

-- 8. Coding Club Quiz: already finished (by Vikram, Coding Club Coordinator)
INSERT INTO events (id, scope, event_type_id, fest_id, club_id, created_by, title, venue_id,
                    start_time, end_time, registration_deadline, capacity, status)
VALUES (8, 'single_club', 9, 3, 8, 9, 'Coding Club Quiz', 2,
        '2026-10-20 18:00:00', '2026-10-20 19:30:00', '2026-10-19 23:59:59', 100, 'published');

-- 9. Python for Data Science: self-paced, running now, online (no venue) (by Dr. Kavita Sharma)
INSERT INTO events (id, scope, event_type_id, created_by, title,
                    start_time, end_time, registration_deadline, certificate_criteria, status)
VALUES (9, 'faculty', 5, 3, 'Python for Data Science',
        '2026-10-01 00:00:00', '2026-12-31 23:59:59', '2026-12-15 23:59:59', 'completion', 'published');

-- 10. Drone Wars: still a DRAFT inside Quantz (by Ishita)
INSERT INTO events (id, scope, event_type_id, fest_id, parent_event_id, created_by, title, venue_id,
                    start_time, end_time, registration_deadline, capacity, fee,
                    is_team_event, team_min, team_max, status)
VALUES (10, 'fest', 7, 3, 1, 10, 'Drone Wars', 8,
        '2026-11-16 10:00:00', '2026-11-16 13:00:00', '2026-11-13 23:59:59', 30, 100.00,
        1, 1, 3, 'draft');

-- Gusto's participating clubs (both Vivacity clubs)
INSERT INTO event_clubs (event_id, fest_id, club_id) VALUES
  (5, 1, 1),   -- Music Club
  (5, 1, 2);   -- Dance Club

-- Eligibility grid
INSERT INTO event_eligibility (event_id, program, year) VALUES
  (4, 'UG', 1), (4, 'UG', 2),                                -- Music Recruitment: UG 1st & 2nd year
  (7, 'UG', 2), (7, 'UG', 3), (7, 'PG', 1), (7, 'PG', 2);    -- Workshop: UG 2-3 + all PG

INSERT INTO event_eligible_departments (event_id, department_id) VALUES
  (7, 1), (7, 2);                                            -- Workshop: CSE and CCE only

-- One file record (the actual PDF doesn't exist on disk yet; that comes with uploads)
INSERT INTO event_files (id, event_id, title, stored_name, original_name, mime_type, size_bytes, uploaded_by)
VALUES (1, 6, 'FDP Brochure', 'fdp-ml-brochure-3f9a2c.pdf', 'FDP_ML_Brochure.pdf', 'application/pdf', 248000, 2);