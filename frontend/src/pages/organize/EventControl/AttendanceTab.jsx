import { useState } from 'react';
import { Alert, Button, Card, Form, Nav, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../../api/client';
import Loading from '../../../components/Loading';
import useLoad from '../../../utils/useLoad';
import { formatRange } from '../../../utils/format';

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function AttendanceTab({ event }) {
  const { data, loading, error, reload } = useLoad(`/events/${event.id}/attendance`);
  const [sessionId, setSessionId] = useState(null);
  const [ticked, setTicked] = useState(null); // null = not edited, show what is saved
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');

  if (loading && !data) return <Loading />;
  if (!data) return <Alert variant="danger">{error}</Alert>;

  const sessions = data.sessions;
  if (sessions.length === 0) {
    return <Alert variant="info">This event has no sessions, so there's nothing to mark. Add sessions on the Sessions tab.</Alert>;
  }

  const ownId = data.own_registration_id; // set only for delegates who are also participants
  const startedSessions = sessions.filter((s) => s.started);
  const current =
    sessions.find((s) => s.id === sessionId) ?? startedSessions[startedSessions.length - 1] ?? sessions[0];
  const saved = data.participants.filter((p) => p.present_session_ids.includes(current.id)).map((p) => p.registration_id);
  const present = ticked ?? saved;
  const editable = Boolean(current.started) && event.status !== 'cancelled';
  const byAttendance = data.certificate_criteria === 'attendance';
  const ownSaved = ownId !== null && saved.includes(ownId);

  const term = search.trim().toLowerCase();
  const visible = term
    ? data.participants.filter((p) => p.name.toLowerCase().includes(term) || (p.roll_no ?? '').toLowerCase().includes(term))
    : data.participants;

  // "All" / "None" never change your own saved mark
  function markEveryone(allPresent) {
    const others = allPresent ? data.participants.map((p) => p.registration_id).filter((id) => id !== ownId) : [];
    setTicked(ownSaved ? [...others, ownId] : others);
  }

  function chooseSession(id) {
    if (ticked !== null && !window.confirm('Discard the ticks you have not saved?')) return;
    setSessionId(Number(id));
    setTicked(null);
    setNotice('');
    setSaveError('');
  }

  async function save() {
    setSaving(true);
    setNotice('');
    setSaveError('');
    try {
      const res = await api.put(`/events/${event.id}/sessions/${current.id}/attendance`, {
        present_registration_ids: present,
      });
      setNotice(res.data.message);
      setTicked(null);
      reload();
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Nav variant="pills" className="mb-3 gap-1" activeKey={String(current.id)} onSelect={chooseSession}>
        {sessions.map((s) => (
          <Nav.Item key={s.id}>
            <Nav.Link eventKey={String(s.id)} className="py-1 px-3">
              {s.title}
              {!s.started && <span className="small opacity-75"> (not started)</span>}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      <p className="small text-muted">
        {formatRange(current.start_time, current.end_time)}
        {byAttendance && ` · Certificates need ${data.min_attendance_percent}% of ${sessions.length} session(s).`}
      </p>

      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {saveError && <Alert variant="danger" className="py-2">{saveError}</Alert>}
      {!current.started && <Alert variant="info" className="py-2">You can mark this session once it has started.</Alert>}
      {ownId !== null && (
        <Alert variant="secondary" className="py-2 small">You're also a participant, so an event manager marks your own attendance.</Alert>
      )}

      <Card>
        <Card.Header className="d-flex flex-wrap gap-2 align-items-center">
          <Form.Control
            size="sm"
            placeholder="Search name or roll no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '16rem' }}
            aria-label="Search participants"
          />
          <span className="small text-muted me-auto">
            {present.length} of {data.participants.length} present{ticked !== null && ' · unsaved changes'}
          </span>
          <Button size="sm" variant="link" disabled={!editable} onClick={() => markEveryone(true)}>All present</Button>
          <Button size="sm" variant="link" disabled={!editable} onClick={() => markEveryone(false)}>None</Button>
          <Button size="sm" disabled={!editable || saving || ticked === null} onClick={save}>
            {saving ? 'Saving…' : `Save (${present.length} present)`}
          </Button>
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th style={{ width: '3rem' }}>Here</th>
              <th>Participant</th>
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-muted py-4">No confirmed participants.</td>
              </tr>
            )}
            {visible.map((p) => {
              const isOwn = p.registration_id === ownId;
              return (
                <tr key={p.registration_id}>
                  <td>
                    <Form.Check
                      aria-label={`${p.name} present`}
                      checked={present.includes(p.registration_id)}
                      disabled={!editable || isOwn}
                      onChange={() => setTicked(toggle(present, p.registration_id))}
                    />
                  </td>
                  <td>
                    {p.name}
                    {isOwn && <span className="soft-badge tone-muted ms-2">You</span>}
                    <div className="small text-muted">{p.roll_no || 'Faculty'}</div>
                  </td>
                  <td className="small">
                    {p.attended}/{p.total}
                    {byAttendance && p.meets_criteria && (
                      <span className="soft-badge tone-success ms-2">Meets {data.min_attendance_percent}%</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}