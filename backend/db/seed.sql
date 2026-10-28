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