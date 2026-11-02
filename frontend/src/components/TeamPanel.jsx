import { useState } from 'react';
import { Alert, Button, Form, InputGroup, ListGroup } from 'react-bootstrap';
import api, { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import useLoad from '../utils/useLoad';
import { seatsLeft } from '../utils/eventBadges';
import { REGISTRATION_LABELS } from '../utils/format';
import ConfirmModal from './ConfirmModal';
import PayButton from './PayButton';

const LIVE_STATUSES = ['pending', 'approved', 'confirmed'];

export default function TeamPanel({ event, onChanged }) {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: teams } = useLoad(`/me/teams?r=${refreshKey}`);
  const [teamName, setTeamName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // 'cancelTeam' | 'cancelRegistration'

  if (!teams) return null;

  const mine = teams.filter((t) => t.event_id === event.id);
  const team = mine.find((t) => t.my_status === 'accepted');
  const invites = mine.filter((t) => t.my_status === 'invited');
  const my = event.my;
  const status = my.registration?.status;
  const isLeader = team?.leader_id === user.id;
  const accepted = team ? team.members.filter((m) => m.invite_status === 'accepted') : [];
  const pending = team ? team.members.filter((m) => m.invite_status === 'invited') : [];

  // Same conditions as the solo Register button
  const canStart =
    !team &&
    !my.can_manage &&
    event.lifecycle === 'registration_open' &&
    !LIVE_STATUSES.includes(status) &&
    my.eligible === true &&
    my.clash_with.length === 0 &&
    seatsLeft(event) !== 0;

  function refreshAll() {
    setRefreshKey((k) => k + 1);
    onChanged();
  }

  async function act(request, after) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await request();
      setNotice(res.data.message);
      after?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      setConfirm(null);
      refreshAll();
    }
  }

  function createTeam(e) {
    e.preventDefault();
    act(() => api.post(`/events/${event.id}/teams`, { name: teamName.trim() }), () => setTeamName(''));
  }

  function invite(e) {
    e.preventDefault();
    act(() => api.post(`/teams/${team.id}/members`, { roll_no: rollNo.trim() }), () => setRollNo(''));
  }

  const stageLabel = team?.status === 'forming' ? 'Forming' : REGISTRATION_LABELS[status] ?? 'Submitted';

  return (
    <div className="mt-3">
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      {/* Invites waiting for me */}
      {invites.map((t) => (
        <div key={t.id} className="border rounded p-2 mb-3">
          <div className="small">
            <strong>{t.leader_name}</strong> invited you to team <strong>{t.name}</strong>.
          </div>
          <div className="d-flex gap-2 mt-2">
            <Button size="sm" disabled={busy} onClick={() => act(() => api.post(`/teams/${t.id}/accept`))}>Accept</Button>
            <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => act(() => api.post(`/teams/${t.id}/decline`))}>
              Decline
            </Button>
          </div>
        </div>
      ))}

      {/* My team */}
      {team && (
        <>
          <div className="d-flex justify-content-between align-items-center">
            <strong>Team {team.name}</strong>
            <span className="small text-muted">{stageLabel}</span>
          </div>
          <ListGroup variant="flush" className="my-2">
            {team.members.map((m) => (
              <ListGroup.Item key={m.user_id} className="px-0 d-flex justify-content-between align-items-center">
                <span className={m.invite_status === 'invited' ? 'text-muted' : ''}>
                  {m.name}
                  {m.user_id === team.leader_id && <span className="soft-badge tone-neutral ms-2">Leader</span>}
                  {m.invite_status === 'invited' && <span className="small ms-2">(invited)</span>}
                </span>
                {isLeader && team.status === 'forming' && m.user_id !== team.leader_id && (
                  <Button
                    size="sm"
                    variant="link"
                    className="text-muted p-0"
                    aria-label={`Remove ${m.name}`}
                    disabled={busy}
                    onClick={() => act(() => api.delete(`/teams/${team.id}/members/${m.user_id}`))}
                  >
                    ×
                  </Button>
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>

          {/* Forming: leader builds the team, members can leave */}
          {team.status === 'forming' && isLeader && (
            <>
              <Form onSubmit={invite} className="mb-2">
                <InputGroup size="sm">
                  <Form.Control
                    placeholder="Teammate's roll no."
                    aria-label="Teammate's roll number"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    required
                  />
                  <Button type="submit" variant="outline-primary" disabled={busy}>Invite</Button>
                </InputGroup>
              </Form>
              <div className="small text-muted mb-2">
                {accepted.length} joined{pending.length > 0 && `, ${pending.length} invited`} · teams of {event.team_min}–{event.team_max}
              </div>
              <Button
                className="w-100"
                disabled={busy || pending.length > 0 || accepted.length < event.team_min}
                onClick={() => act(() => api.post(`/teams/${team.id}/submit`))}
              >
                Submit team ({accepted.length})
              </Button>
              {pending.length > 0 && <div className="small text-muted mt-1">Wait for pending invites, or remove them, before submitting.</div>}
              <Button variant="link" size="sm" className="text-danger p-0 mt-2" onClick={() => setConfirm('cancelTeam')}>
                Cancel team
              </Button>
            </>
          )}
          {team.status === 'forming' && !isLeader && (
            <>
              <div className="small text-muted mb-2">Waiting for {team.leader_name} to submit the team.</div>
              <Button
                variant="link"
                size="sm"
                className="text-danger p-0"
                disabled={busy}
                onClick={() => act(() => api.delete(`/teams/${team.id}/members/${user.id}`))}
              >
                Leave team
              </Button>
            </>
          )}

          {/* Submitted: the leader pays once and can cancel for everyone */}
          {team.status === 'submitted' && status === 'approved' && isLeader && (
            <PayButton registrationId={my.registration.id} amount={event.fee} title={`${event.title} (team ${team.name})`} onDone={refreshAll} className="w-100" />
          )}
          {team.status === 'submitted' && status === 'approved' && !isLeader && (
            <div className="small text-muted">Waiting for {team.leader_name} to pay ₹{event.fee} for the team.</div>
          )}
          {team.status === 'submitted' && isLeader && LIVE_STATUSES.includes(status) &&
            ['registration_open', 'registration_closed'].includes(event.lifecycle) && (
              <Button variant="link" size="sm" className="text-danger p-0 mt-2" onClick={() => setConfirm('cancelRegistration')}>
                Cancel team registration
              </Button>
            )}
        </>
      )}

      {/* No team yet */}
      {canStart && (
        <Form onSubmit={createTeam} className={invites.length ? 'mt-3' : ''}>
          <Form.Label htmlFor="team-name" className="small">
            Teams of {event.team_min}–{event.team_max}. Create one and invite teammates by roll number.
          </Form.Label>
          <InputGroup>
            <Form.Control id="team-name" placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required maxLength={60} />
            <Button type="submit" disabled={busy}>Create team</Button>
          </InputGroup>
        </Form>
      )}

      <ConfirmModal
        show={confirm !== null}
        title={confirm === 'cancelTeam' ? 'Cancel team' : 'Cancel team registration'}
        confirmLabel="Cancel it"
        variant="danger"
        busy={busy}
        onConfirm={() =>
          confirm === 'cancelTeam'
            ? act(() => api.post(`/teams/${team.id}/cancel`))
            : act(() => api.post(`/registrations/${my.registration.id}/cancel`))
        }
        onHide={() => setConfirm(null)}
      >
        {confirm === 'cancelTeam'
          ? `Cancel team ${team?.name}? Everyone in it is released and can join another team.`
          : `Cancel the registration of all ${accepted.length} members of team ${team?.name}? Your seat goes to someone else.`}
      </ConfirmModal>
    </div>
  );
}