import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../../api/client';
import ConfirmModal from '../../../components/ConfirmModal';
import StatusBadge from '../../../components/StatusBadge';
import { CRITERIA_LABELS, formatDateTime, formatRange } from '../../../utils/format';

// 'UG: years 1, 2 · PG: year 1'  or  'All programs and years'
function eligibilitySummary(eligibility) {
  const byProgram = {};
  for (const c of eligibility.cells) {
    (byProgram[c.program] ||= []).push(c.year);
  }
  const programs = Object.entries(byProgram).map(
    ([program, years]) => `${program}: year${years.length > 1 ? 's' : ''} ${years.join(', ')}`
  );
  const grid = programs.length > 0 ? programs.join(' · ') : 'All programs and years';
  const departments =
    eligibility.departments.length > 0 ? eligibility.departments.map((d) => d.code).join(', ') : 'All departments';
  return { grid, departments };
}

export default function OverviewTab({ event, onChanged }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const canManage = event.my.can_manage;
  const isDraft = event.status === 'draft';
  const isPublished = event.status === 'published';
  const finished = event.lifecycle === 'completed';
  const { grid, departments } = eligibilitySummary(event.eligibility);

  // Shared steps for every action button
  async function runAction(request, successMessage) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request();
      setNotice(successMessage);
      onChanged();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(e) {
    e.preventDefault();
    const ok = await runAction(() => api.post(`/events/${event.id}/cancel`, { reason }), 'The event has been cancelled.');
    if (ok) {
      setShowCancel(false);
      setReason('');
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/events/${event.id}`);
      navigate('/organize', { state: { message: `"${event.title}" was deleted.` } });
    } catch (err) {
      setError(getErrorMessage(err));
      setShowDelete(false);
      setBusy(false);
    }
  }

  return (
    <Row className="g-4">
      <Col lg={8}>
        <Card body>
          <div className="section-label">Details</div>
          <dl className="info-list">
            <dt>When</dt>
            <dd>{formatRange(event.start_time, event.end_time)}</dd>
            <dt>Venue</dt>
            <dd>{event.venue_name || 'To be announced'}</dd>
            {event.type_name && (
              <>
                <dt>Type</dt>
                <dd>{event.type_name}</dd>
              </>
            )}
            {event.parent_title && (
              <>
                <dt>Part of</dt>
                <dd>{event.parent_title}</dd>
              </>
            )}
            {event.participating_clubs.length > 0 && (
              <>
                <dt>Clubs</dt>
                <dd>{event.participating_clubs.map((c) => c.name).join(', ')}</dd>
              </>
            )}

            {event.kind === 'normal' && !event.registration_required && (
              <>
                <dt>Registration</dt>
                <dd>Not needed: anyone can attend</dd>
              </>
            )}
            {event.kind === 'normal' && Boolean(event.registration_required) && (
              <>
                <dt>Registration</dt>
                <dd>Closes {formatDateTime(event.registration_deadline)}</dd>
                <dt>Seats</dt>
                <dd>{event.my.seats_taken} taken of {event.capacity ?? 'unlimited'}</dd>
                <dt>Fee</dt>
                <dd>{Number(event.fee) > 0 ? `₹${event.fee}` : 'Free'}</dd>
                <dt>Approval</dt>
                <dd>{event.auto_approve ? 'Automatic' : 'An organizer approves each registration'}</dd>
                <dt>Certificates</dt>
                <dd>
                  {CRITERIA_LABELS[event.certificate_criteria]}
                  {event.certificate_criteria === 'attendance' && ` (${event.min_attendance_percent}%)`}
                </dd>
                <dt>Who</dt>
                <dd>
                  {grid}
                  <div className="small text-muted">{departments}</div>
                </dd>
              </>
            )}

            {event.status === 'cancelled' && (
              <>
                <dt>Cancelled</dt>
                <dd className="text-danger">{event.cancel_reason}</dd>
              </>
            )}
          </dl>

          {event.description && (
            <>
              <hr />
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{event.description}</p>
            </>
          )}
        </Card>

        {event.kind === 'umbrella' && (
          <Card body className="mt-4">
            <div className="section-label">Events inside (published)</div>
            {event.children.length === 0 ? (
              <p className="text-muted mb-0">None published yet.</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {event.children.map((child) => (
                  <li key={child.id} className="d-flex flex-wrap gap-2 align-items-center mb-2">
                    <StatusBadge lifecycle={child.lifecycle} />
                    <Link to={`/organize/events/${child.id}`}>{child.title}</Link>
                    <span className="small text-muted">{formatRange(child.start_time, child.end_time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </Col>

      {canManage && (
        <Col lg={4}>
          <Card body>
            <div className="section-label">Actions</div>
            {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {isDraft && (
              <>
                <p className="small text-muted">Only organizers can see a draft. Publish it to open it to participants.</p>
                <div className="d-grid gap-2">
                  <Button disabled={busy} onClick={() => runAction(() => api.post(`/events/${event.id}/publish`), 'Published. Participants can now see it.')}>
                    Publish
                  </Button>
                  <Button variant="outline-danger" disabled={busy} onClick={() => setShowDelete(true)}>
                    Delete draft
                  </Button>
                </div>
              </>
            )}

            {isPublished && !finished && (
              <>
                <p className="small text-muted">Moving back to draft only works while nobody has registered. Otherwise cancel it.</p>
                <div className="d-grid gap-2">
                  <Button
                    variant="outline-primary"
                    disabled={busy}
                    onClick={() => runAction(() => api.post(`/events/${event.id}/unpublish`), 'Moved back to draft.')}
                  >
                    Move back to draft
                  </Button>
                  <Button variant="outline-danger" disabled={busy} onClick={() => setShowCancel(true)}>
                    Cancel event
                  </Button>
                </div>
              </>
            )}

            {isPublished && finished && <p className="mb-0 text-muted">This event has finished.</p>}
            {event.status === 'cancelled' && <p className="mb-0 text-muted">This event was cancelled and is kept for the record.</p>}
          </Card>
        </Col>
      )}

      <Modal show={showCancel} onHide={() => setShowCancel(false)} centered>
        <Form onSubmit={handleCancel}>
          <Modal.Header closeButton>
            <Modal.Title as="h3" className="h5">Cancel {event.title}?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {event.kind === 'umbrella' && (
              <Alert variant="warning" className="py-2">Every event inside it will be cancelled too.</Alert>
            )}
            <Form.Label htmlFor="cancel-reason">Reason (shown to participants)</Form.Label>
            <Form.Control
              id="cancel-reason"
              as="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCancel(false)}>Keep event</Button>
            <Button type="submit" variant="danger" disabled={busy}>{busy ? 'Cancelling…' : 'Cancel event'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal
        show={showDelete}
        title="Delete draft"
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={handleDelete}
        onHide={() => setShowDelete(false)}
      >
        Delete <strong>{event.title}</strong> for good? Its sessions and settings are removed too.
      </ConfirmModal>
    </Row>
  );
}