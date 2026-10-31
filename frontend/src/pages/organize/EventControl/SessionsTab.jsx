import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../../api/client';
import ConfirmModal from '../../../components/ConfirmModal';
import { formatRange, toInputDateTime } from '../../../utils/format';

export default function SessionsTab({ event, onChanged }) {
  const [editing, setEditing] = useState(null); // null = closed, 'new' = adding, a session = editing it
  const [form, setForm] = useState({ title: '', start_time: '', end_time: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const locked = event.status === 'cancelled';
  const sessions = event.sessions;

  function openForm(session) {
    setForm(
      session
        ? { title: session.title, start_time: toInputDateTime(session.start_time), end_time: toInputDateTime(session.end_time) }
        : {
            title: `Session ${sessions.length + 1}`,
            start_time: toInputDateTime(event.start_time),
            end_time: toInputDateTime(event.end_time),
          }
    );
    setFormError('');
    setEditing(session || 'new');
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await api.post(`/events/${event.id}/sessions`, form);
      } else {
        await api.patch(`/events/${event.id}/sessions/${editing.id}`, form);
      }
      setEditing(null);
      onChanged();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError('');
    try {
      await api.delete(`/events/${event.id}/sessions/${removeTarget.id}`);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  return (
    <>
      <p className="text-muted">
        Attendance is marked per session. They were created from the event's dates; adjust them if the real schedule differs.
      </p>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h2 className="h6 mb-0">Sessions</h2>
          {!locked && <Button size="sm" onClick={() => openForm()}>+ Add session</Button>}
        </Card.Header>
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Title</th>
              <th>Time</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-muted py-4">
                  No sessions. Events without registration or with completion-based certificates don't need them.
                </td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td className="small">{formatRange(s.start_time, s.end_time)}</td>
                <td className="text-end text-nowrap">
                  {!locked && (
                    <>
                      <Button size="sm" variant="link" onClick={() => openForm(s)}>Edit</Button>
                      <Button size="sm" variant="link" className="text-muted" onClick={() => setRemoveTarget(s)}>Remove</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal show={editing !== null} onHide={() => setEditing(null)} centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title as="h3" className="h5">{editing === 'new' ? 'Add session' : 'Edit session'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger" className="py-2">{formError}</Alert>}
            <Form.Group className="mb-3" controlId="session-title">
              <Form.Label>Title</Form.Label>
              <Form.Control value={form.title} onChange={(e) => setField('title', e.target.value)} required maxLength={100} />
            </Form.Group>
            <Row className="g-3">
              <Col sm={6}>
                <Form.Label htmlFor="session-start">Starts</Form.Label>
                <Form.Control
                  id="session-start"
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setField('start_time', e.target.value)}
                  required
                />
              </Col>
              <Col sm={6}>
                <Form.Label htmlFor="session-end">Ends</Form.Label>
                <Form.Control
                  id="session-end"
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setField('end_time', e.target.value)}
                  required
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal
        show={removeTarget !== null}
        title="Remove session"
        confirmLabel="Remove"
        variant="danger"
        busy={removing}
        onConfirm={handleRemove}
        onHide={() => setRemoveTarget(null)}
      >
        Remove <strong>{removeTarget?.title}</strong>? This only works while no attendance has been marked for it.
      </ConfirmModal>
    </>
  );
}