const pool = require('../db/pool');
const HttpError = require('../utils/HttpError');
const { notify } = require('../services/notificationService');
const { loadEventForRegistration, assertCanParticipate, countSeats } = require('../services/registrationService');
const { REGISTRATION_STATUS } = require('../config/constants');

const ACTIVE_INVITES = ['invited', 'accepted'];

// ---------- helpers ----------

async function loadTeam(teamIdParam) {
  const teamId = Number(teamIdParam);
  if (!Number.isInteger(teamId) || teamId < 1) throw new HttpError(400, 'Invalid team id');
  const [[team]] = await pool.query(
    'SELECT t.*, u.name AS leader_name FROM teams t JOIN users u ON u.id = t.leader_id WHERE t.id = ?',
    [teamId]
  );
  if (!team) throw new HttpError(404, 'Team not found');
  return team;
}

function requireLeader(team, user) {
  if (team.leader_id !== user.id) throw new HttpError(403, 'Only the team leader can do this');
}

function requireForming(team) {
  if (team.status === 'submitted') throw new HttpError(409, 'This team has already registered');
  if (team.status === 'cancelled') throw new HttpError(409, 'This team was cancelled');
}

async function openEventFor(team) {
  const event = await loadEventForRegistration(team.event_id);
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

async function inAcceptedTeam(userId, eventId) {
  const [rows] = await pool.query(
    "SELECT 1 FROM team_members WHERE user_id = ? AND event_id = ? AND invite_status = 'accepted' LIMIT 1",
    [userId, eventId]
  );
  return rows.length > 0;
}

// Cancel a team and free its members to join another team for this event
async function releaseTeam(conn, teamId) {
  await conn.query("UPDATE teams SET status = 'cancelled' WHERE id = ?", [teamId]);
  await conn.query(
    "UPDATE team_members SET invite_status = 'declined', responded_at = COALESCE(responded_at, NOW()) WHERE team_id = ?",
    [teamId]
  );
}

async function memberIds(teamId, statuses = ACTIVE_INVITES) {
  const [rows] = await pool.query('SELECT user_id FROM team_members WHERE team_id = ? AND invite_status IN (?)', [teamId, statuses]);
  return rows.map((r) => r.user_id);
}

// ---------- handlers ----------

// POST /events/:id/teams   { name }
async function createTeam(req, res) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) throw new HttpError(400, 'Invalid event id');
  const event = await loadEventForRegistration(eventId);
  if (!event) throw new HttpError(404, 'Event not found');
  if (!event.is_team_event) throw new HttpError(400, 'This event takes individual registrations');

  await assertCanParticipate(req.user, event);
  if (await inAcceptedTeam(req.user.id, eventId)) throw new HttpError(409, 'You are already in a team for this event');

  const conn = await pool.getConnection();
  let teamId;
  try {
    await conn.beginTransaction();
    const [result] = await conn.query('INSERT INTO teams (event_id, name, leader_id) VALUES (?, ?, ?)', [
      eventId,
      req.body.name,
      req.user.id,
    ]);
    teamId = result.insertId;
    await conn.query(
      "INSERT INTO team_members (team_id, event_id, user_id, invite_status, responded_at) VALUES (?, ?, ?, 'accepted', NOW())",
      [teamId, eventId, req.user.id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, /uq_teams_event_name/.test(err.sqlMessage) ? 'That team name is already taken for this event' : 'You are already in a team for this event');
    }
    throw err;
  } finally {
    conn.release();
  }

  res.status(201).json({ message: `Team ${req.body.name} created. Now invite your teammates.`, id: teamId });
}

// GET /me/teams — teams I'm in or invited to (not cancelled), with members
async function listMine(req, res) {
  const [teams] = await pool.query(
    `SELECT t.id, t.event_id, t.name, t.leader_id, t.status, u.name AS leader_name,
            e.title, e.team_min, e.team_max, e.fee, e.lifecycle,
            tm.invite_status AS my_status
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       JOIN users u ON u.id = t.leader_id
       JOIN v_events e ON e.id = t.event_id
      WHERE tm.user_id = ? AND tm.invite_status IN (?) AND t.status <> 'cancelled'
      ORDER BY e.start_time DESC`,
    [req.user.id, ACTIVE_INVITES]
  );
  if (teams.length === 0) return res.json([]);

  const [members] = await pool.query(
    `SELECT tm.team_id, tm.user_id, tm.invite_status, u.name, u.roll_no
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id IN (?) AND tm.invite_status IN (?)
      ORDER BY tm.invite_status, u.name`,
    [teams.map((t) => t.id), ACTIVE_INVITES]
  );

  res.json(teams.map((t) => ({ ...t, members: members.filter((m) => m.team_id === t.id) })));
}

// POST /teams/:id/members   { roll_no }   (leader)
async function invite(req, res) {
  const team = await loadTeam(req.params.id);
  requireLeader(team, req.user);
  requireForming(team);
  const event = await openEventFor(team);

  const [[invitee]] = await pool.query(
    'SELECT id, name, role, is_active, program, year, department_id FROM users WHERE roll_no = ?',
    [req.body.roll_no]
  );
  if (!invitee || !invitee.is_active || invitee.role !== 'student') throw new HttpError(404, 'No active student with that roll number');
  if (invitee.id === req.user.id) throw new HttpError(400, 'You are already in the team');

  const [[{ size }]] = await pool.query('SELECT COUNT(*) AS size FROM team_members WHERE team_id = ? AND invite_status IN (?)', [
    team.id,
    ACTIVE_INVITES,
  ]);
  if (size >= event.team_max) throw new HttpError(409, `A team can have at most ${event.team_max} members (including pending invites)`);

  await assertCanParticipate(invitee, event, invitee.name);
  if (await inAcceptedTeam(invitee.id, event.id)) throw new HttpError(409, `${invitee.name} is already in a team for this event`);

  const [[existing]] = await pool.query('SELECT invite_status FROM team_members WHERE team_id = ? AND user_id = ?', [team.id, invitee.id]);
  if (existing && existing.invite_status !== 'declined') {
    throw new HttpError(409, `${invitee.name} is already ${existing.invite_status === 'accepted' ? 'in the team' : 'invited'}`);
  }
  if (existing) {
    await pool.query(
      "UPDATE team_members SET invite_status = 'invited', invited_at = NOW(), responded_at = NULL WHERE team_id = ? AND user_id = ?",
      [team.id, invitee.id]
    );
  } else {
    await pool.query('INSERT INTO team_members (team_id, event_id, user_id) VALUES (?, ?, ?)', [team.id, event.id, invitee.id]);
  }

  await notify([invitee.id], `${req.user.name} invited you to team ${team.name} for ${event.title}`, `/events/${event.id}`);
  res.status(201).json({ message: `Invite sent to ${invitee.name}` });
}

// DELETE /teams/:id/members/:userId   (a member leaving, or the leader removing someone)
async function removeMember(req, res) {
  const team = await loadTeam(req.params.id);
  requireForming(team);
  const userId = req.params.userId;
  const leaving = userId === req.user.id;
  if (!leaving) requireLeader(team, req.user);
  if (userId === team.leader_id) throw new HttpError(400, 'The leader cannot leave. Cancel the team instead.');

  const [result] = await pool.query('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [team.id, userId]);
  if (result.affectedRows === 0) throw new HttpError(404, 'Not a member of this team');

  if (leaving) await notify([team.leader_id], `${req.user.name} left team ${team.name}`, null, { email: false });
  else await notify([userId], `You were removed from team ${team.name}`, null, { email: false });
  res.json({ message: leaving ? `You left ${team.name}` : 'Member removed' });
}

// POST /teams/:id/accept  and  /teams/:id/decline
function respond(accept) {
  return async (req, res) => {
    const team = await loadTeam(req.params.id);
    requireForming(team);
    const [[row]] = await pool.query('SELECT invite_status FROM team_members WHERE team_id = ? AND user_id = ?', [team.id, req.user.id]);
    if (!row || row.invite_status !== 'invited') throw new HttpError(404, 'You have no pending invite for this team');

    if (accept) {
      const event = await openEventFor(team);
      await assertCanParticipate(req.user, event);
      if (await inAcceptedTeam(req.user.id, event.id)) throw new HttpError(409, 'You are already in a team for this event');
      try {
        await pool.query(
          "UPDATE team_members SET invite_status = 'accepted', responded_at = NOW() WHERE team_id = ? AND user_id = ?",
          [team.id, req.user.id]
        );
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You are already in a team for this event');
        throw err;
      }
    } else {
      await pool.query(
        "UPDATE team_members SET invite_status = 'declined', responded_at = NOW() WHERE team_id = ? AND user_id = ?",
        [team.id, req.user.id]
      );
    }

    await notify([team.leader_id], `${req.user.name} ${accept ? 'joined' : 'declined'} team ${team.name}`, null, { email: false });
    res.json({ message: accept ? `You joined ${team.name}` : 'Invite declined' });
  };
}

// POST /teams/:id/submit   (leader) — register every accepted member together
async function submit(req, res) {
  const team = await loadTeam(req.params.id);
  requireLeader(team, req.user);
  requireForming(team);
  const event = await openEventFor(team);

  const [members] = await pool.query(
    `SELECT tm.user_id, tm.invite_status, u.name, u.role, u.program, u.year, u.department_id
       FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ? AND tm.invite_status IN (?)`,
    [team.id, ACTIVE_INVITES]
  );
  const pending = members.filter((m) => m.invite_status === 'invited');
  const accepted = members.filter((m) => m.invite_status === 'accepted');
  if (pending.length > 0) {
    throw new HttpError(409, `${pending.length} invite(s) are still pending. Wait for them or remove them first.`);
  }
  if (accepted.length < event.team_min || accepted.length > event.team_max) {
    throw new HttpError(409, `Teams need ${event.team_min} to ${event.team_max} members; yours has ${accepted.length}`);
  }

  // Every member must be able to take part (eligibility, clash, not already registered, …)
  for (const m of accepted) {
    const person = { id: m.user_id, role: m.role, program: m.program, year: m.year, department_id: m.department_id };
    await assertCanParticipate(person, event, m.user_id === req.user.id ? null : m.name);
  }

  const conn = await pool.getConnection();
  let status;
  try {
    await conn.beginTransaction();

    const [[locked]] = await conn.query('SELECT capacity, fee, auto_approve FROM events WHERE id = ? FOR UPDATE', [event.id]);
    if (locked.capacity !== null && (await countSeats(conn, event.id, { lock: true })) + 1 > locked.capacity) {
      throw new HttpError(409, 'Event is full');
    }

    if (!locked.auto_approve) status = REGISTRATION_STATUS.PENDING;
    else status = Number(locked.fee) > 0 ? REGISTRATION_STATUS.APPROVED : REGISTRATION_STATUS.CONFIRMED;

    // One registration per member; reuse an old (cancelled/rejected) row if there is one
    await conn.query(
      `INSERT INTO registrations (event_id, user_id, team_id, status) VALUES ? AS new
       ON DUPLICATE KEY UPDATE status = new.status, team_id = new.team_id, registered_at = NOW(),
                               rejection_reason = NULL, decided_by = NULL, decided_at = NULL,
                               completed = 0, completion_marked_by = NULL, completion_marked_at = NULL`,
      [accepted.map((m) => [event.id, m.user_id, team.id, status])]
    );
    await conn.query("UPDATE teams SET status = 'submitted' WHERE id = ?", [team.id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const messages = {
    confirmed: `Team ${team.name} is registered for ${event.title}.`,
    approved: `Team ${team.name} is approved for ${event.title}. ${team.leader_name} pays ₹${event.fee} to confirm.`,
    pending: `Team ${team.name} applied for ${event.title}. The organizer will review it.`,
  };
  await notify(accepted.map((m) => m.user_id), messages[status], `/events/${event.id}`, { email: status !== 'pending' });
  res.status(201).json({ message: messages[status], status });
}

// POST /teams/:id/cancel   (leader, while forming)
async function cancelTeam(req, res) {
  const team = await loadTeam(req.params.id);
  requireLeader(team, req.user);
  requireForming(team);
  const others = (await memberIds(team.id)).filter((id) => id !== req.user.id);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await releaseTeam(conn, team.id);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await notify(others, `Team ${team.name} was cancelled by ${req.user.name}`, null, { email: false });
  res.json({ message: `Team ${team.name} cancelled` });
}

module.exports = {
  createTeam,
  listMine,
  invite,
  removeMember,
  accept: respond(true),
  decline: respond(false),
  submit,
  cancelTeam,
  releaseTeam,
};