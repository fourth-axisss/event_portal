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