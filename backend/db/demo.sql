-- =========================================================
-- demo.sql — demo events relative to TODAY. Safe to re-run.
-- Run with the ROOT connection in Workbench (needs temporary tables).
-- =========================================================
USE event_portal;
   SET time_zone = '+05:30';
SET SQL_SAFE_UPDATES = 0;

-- ---------- 1. Who and what (looked up by name) ----------
SET @riya   = 4;
SET @priya  = 11;
SET @aman   = (SELECT id FROM users WHERE name LIKE 'Aman%'  AND role = 'student' LIMIT 1);
SET @kabir  = (SELECT id FROM users WHERE name LIKE 'Kabir%' AND role = 'student' LIMIT 1);
SET @anil   = (SELECT id FROM users WHERE name LIKE '%Anil%' AND role = 'faculty' LIMIT 1);
SET @third  = (SELECT id FROM users
                WHERE role = 'student' AND is_active = 1 AND id NOT IN (4, 11)
                  AND id NOT IN (SELECT user_id FROM positions)
                ORDER BY id LIMIT 1);
SET @music    = (SELECT id FROM clubs WHERE name LIKE 'Music%' LIMIT 1);
SET @vivacity = (SELECT fest_id FROM clubs WHERE id = @music);
SET @plinth   = (SELECT id FROM fests WHERE name = 'Plinth');
SET @stype = (SELECT id FROM event_types
               WHERE is_active = 1 AND organize_rule IN ('student', 'both') AND participate_rule IN ('student', 'both')
               ORDER BY clash_check DESC, id LIMIT 1);
SET @ftype = (SELECT id FROM event_types
               WHERE is_active = 1 AND organize_rule IN ('faculty', 'both') AND participate_rule IN ('student', 'both')
               ORDER BY id LIMIT 1);
SET @venue = (SELECT id FROM venues WHERE is_active = 1 ORDER BY id LIMIT 1);

-- Check: none of these may be NULL. If one is, stop and fix the lookup above.
SELECT @aman AS aman, @kabir AS kabir, @anil AS anil, @third AS third_student,
       @music AS music_club, @vivacity AS vivacity, @plinth AS plinth,
       @stype AS student_type, @ftype AS faculty_type, @venue AS venue;

-- ---------- 2. Remove earlier demo runs ----------
DROP TEMPORARY TABLE IF EXISTS demo_ids;
   CREATE TEMPORARY TABLE demo_ids (id INT UNSIGNED PRIMARY KEY)
     SELECT id FROM events
   WHERE title IN ('Acoustic Evening', 'Club Auditions', 'Beatbox Battle', 'PG Jam Session',
                   'Guitar Basics Workshop', 'Plinth Tech Week', 'Hack Night', 'Live Coding Quiz',
                   'Cloud Fundamentals Workshop')
     AND created_by IN (@aman, @kabir, @anil);

DELETE FROM certificates       WHERE event_id IN (SELECT id FROM demo_ids);
DELETE FROM feedback           WHERE event_id IN (SELECT id FROM demo_ids);
DELETE FROM session_attendance WHERE event_id IN (SELECT id FROM demo_ids);
DELETE p FROM payments p JOIN registrations r ON r.id = p.registration_id JOIN demo_ids d ON d.id = r.event_id;
DELETE FROM registrations      WHERE event_id IN (SELECT id FROM demo_ids);
DELETE FROM team_members       WHERE event_id IN (SELECT id FROM demo_ids);
DELETE FROM teams              WHERE event_id IN (SELECT id FROM demo_ids);
DELETE e FROM events e JOIN demo_ids d ON d.id = e.id WHERE e.parent_event_id IS NOT NULL;  -- children first
DELETE e FROM events e JOIN demo_ids d ON d.id = e.id;                                       -- then the rest
DROP TEMPORARY TABLE demo_ids;

-- ---------- 3. Music Club events (Aman) ----------
INSERT INTO events (kind, scope, event_type_id, fest_id, club_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'single_club', @stype, @vivacity, @music, @aman, 'Acoustic Evening',
        'An unplugged evening of covers and originals. Bring a friend, or bring your guitar.', @venue,
        TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '18:00:00'), TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '21:00:00'),
        1, TIMESTAMP(CURDATE() + INTERVAL 4 DAY, '23:00:00'), 40, 0, 1, 'attendance', 75, 'published');
SET @acoustic = LAST_INSERT_ID();

INSERT INTO events (kind, scope, event_type_id, fest_id, club_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'single_club', @stype, @vivacity, @music, @aman, 'Club Auditions',
        'Auditions for the Music Club core team. Registrations are reviewed by the coordinators.', @venue,
        TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '17:00:00'), TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '19:00:00'),
        1, TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '23:00:00'), 20, 0, 0, 'none', 75, 'published');
SET @auditions = LAST_INSERT_ID();

INSERT INTO events (kind, scope, event_type_id, fest_id, club_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'single_club', @stype, @vivacity, @music, @aman, 'Beatbox Battle',
        'One-on-one beatbox rounds, judged by the crowd.', @venue,
        TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '18:00:00'), TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '20:00:00'),
        1, TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '23:00:00'), 30, 0, 1, 'attendance', 75, 'published');
SET @beatbox = LAST_INSERT_ID();

INSERT INTO events (kind, scope, event_type_id, fest_id, club_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'single_club', @stype, @vivacity, @music, @aman, 'PG Jam Session',
        'A relaxed jam for postgraduate students.', @venue,
        TIMESTAMP(CURDATE() + INTERVAL 6 DAY, '17:00:00'), TIMESTAMP(CURDATE() + INTERVAL 6 DAY, '19:00:00'),
        1, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '23:00:00'), 25, 0, 1, 'none', 75, 'published');
SET @pgjam = LAST_INSERT_ID();
INSERT INTO event_eligibility (event_id, program, year) VALUES (@pgjam, 'PG', 1), (@pgjam, 'PG', 2);

INSERT INTO events (kind, scope, event_type_id, fest_id, club_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'single_club', @stype, @vivacity, @music, @aman, 'Guitar Basics Workshop',
        'Two hours from first chord to first song. Instruments provided.', @venue,
        TIMESTAMP(CURDATE() + INTERVAL 7 DAY, '16:00:00'), TIMESTAMP(CURDATE() + INTERVAL 7 DAY, '18:00:00'),
        1, TIMESTAMP(CURDATE() + INTERVAL 6 DAY, '23:00:00'), 15, 150, 1, 'attendance', 75, 'published');
SET @guitar = LAST_INSERT_ID();

-- ---------- 4. Plinth umbrella and its events (Kabir) ----------
INSERT INTO events (kind, scope, fest_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, fee, certificate_criteria, status)
VALUES ('umbrella', 'fest', @plinth, @kabir, 'Plinth Tech Week',
        'A week of coding, building and breaking things across every Plinth club.', @venue,
        TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '09:00:00'), TIMESTAMP(CURDATE() + INTERVAL 10 DAY, '21:00:00'),
        0, 0, 'none', 'published');
SET @techweek = LAST_INSERT_ID();

INSERT INTO events (kind, scope, event_type_id, fest_id, parent_event_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, is_team_event, team_min, team_max, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'fest', @stype, @plinth, @techweek, @kabir, 'Hack Night',
        'Five hours, one problem statement, teams of two or three. The leader pays once for the team.', @venue,
        TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '18:00:00'), TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '23:00:00'),
        1, TIMESTAMP(CURDATE() + INTERVAL 4 DAY, '23:00:00'), 10, 100, 0, 1, 2, 3, 'attendance', 75, 'published');
SET @hacknight = LAST_INSERT_ID();

INSERT INTO events (kind, scope, event_type_id, fest_id, parent_event_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'fest', @stype, @plinth, @techweek, @kabir, 'Live Coding Quiz',
        'Rapid-fire rounds on algorithms and debugging. Happening right now.', @venue,
        NOW() - INTERVAL 1 HOUR, NOW() + INTERVAL 2 HOUR,
        1, NOW() - INTERVAL 1 HOUR, 50, 0, 1, 'attendance', 75, 'published');
SET @quiz = LAST_INSERT_ID();

-- ---------- 5. Finished faculty workshop (Dr. Anil) ----------
INSERT INTO events (kind, scope, event_type_id, created_by, title, description, venue_id,
                    start_time, end_time, registration_required, registration_deadline, capacity, fee,
                    auto_approve, certificate_criteria, min_attendance_percent, status)
VALUES ('normal', 'faculty', @ftype, @anil, 'Cloud Fundamentals Workshop',
        'Three mornings of hands-on cloud basics: virtual machines, storage and deployment.', @venue,
        TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '10:00:00'), TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '13:00:00'),
        1, TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '10:00:00'), 30, 0, 1, 'attendance', 75, 'published');
SET @cloud = LAST_INSERT_ID();

-- ---------- 6. Sessions ----------
INSERT INTO event_sessions (event_id, title, start_time, end_time) VALUES
  (@acoustic,  'Session 1', TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '18:00:00'), TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '21:00:00')),
  (@beatbox,   'Session 1', TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '18:00:00'), TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '20:00:00')),
  (@guitar,    'Session 1', TIMESTAMP(CURDATE() + INTERVAL 7 DAY, '16:00:00'), TIMESTAMP(CURDATE() + INTERVAL 7 DAY, '18:00:00')),
  (@hacknight, 'Session 1', TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '18:00:00'), TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '23:00:00')),
  (@quiz,      'Session 1', NOW() - INTERVAL 1 HOUR, NOW() + INTERVAL 2 HOUR),
  (@cloud,     'Day 1', TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '10:00:00'), TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '13:00:00')),
  (@cloud,     'Day 2', TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '10:00:00'), TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '13:00:00')),
  (@cloud,     'Day 3', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '10:00:00'), TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '13:00:00'));

-- ---------- 7. Registrations ----------
INSERT INTO registrations (event_id, user_id, status, decided_by, decided_at) VALUES
  (@auditions, @riya,  'confirmed', @aman, NOW()),   -- approved earlier → Beatbox now clashes for Riya
  (@auditions, @priya, 'pending',   NULL,  NULL);    -- waiting in Aman's approval queue

INSERT INTO registrations (event_id, user_id, status) VALUES
  (@quiz,  @riya,  'confirmed'), (@quiz,  @priya, 'confirmed'), (@quiz,  @third, 'confirmed'),
  (@cloud, @riya,  'confirmed'), (@cloud, @priya, 'confirmed'), (@cloud, @third, 'confirmed');

-- ---------- 8. Attendance for the finished workshop: Riya 3/3, Priya 2/3, third 1/3 ----------
INSERT INTO session_attendance (session_id, event_id, registration_id, method, marked_by)
SELECT s.id, s.event_id, r.id, 'manual', @anil
  FROM event_sessions s
  JOIN registrations r ON r.event_id = s.event_id
 WHERE s.event_id = @cloud
   AND (    r.user_id = @riya
        OR (r.user_id = @priya AND s.title IN ('Day 1', 'Day 2'))
        OR (r.user_id = @third AND s.title = 'Day 1'));

-- ---------- 9. An announcement on the live quiz ----------
INSERT INTO announcements (event_id, posted_by, title, body)
VALUES (@quiz, @kabir, 'Room changed', 'The quiz has moved to the seminar hall on the first floor. Bring your laptop charger.');

SET SQL_SAFE_UPDATES = 1;

-- ---------- 10. What you now have ----------
SELECT id, title, kind, lifecycle, start_time, end_time FROM v_events
 WHERE id IN (@acoustic, @auditions, @beatbox, @pgjam, @guitar, @techweek, @hacknight, @quiz, @cloud)
 ORDER BY start_time;