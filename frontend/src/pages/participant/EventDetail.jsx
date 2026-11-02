/*import { useState } from 'react';
import { Alert, Button, Card, Col, ListGroup, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import BadgeList from '../../components/BadgeList';
import EventCard from '../../components/EventCard';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import { uploadUrl } from '../../utils/assets';
import { downloadFile } from '../../utils/download';
import { getEventBadges, seatsLeft } from '../../utils/eventBadges';
import { describeEligibility, formatDateTime, formatRange, REGISTRATION_LABELS, SCOPE_LABELS } from '../../utils/format';
import useLoad from '../../utils/useLoad';

const CHILD_GROUPS = [
  { title: 'Open for registration', match: (c) => c.lifecycle === 'registration_open' },
  { title: 'Happening now', match: (c) => c.lifecycle === 'ongoing' },
  { title: 'Coming up', match: (c) => ['registration_closed', 'upcoming'].includes(c.lifecycle) },
  { title: 'Completed', match: (c) => c.lifecycle === 'completed' },
];

const LIVE_STATUSES = ['pending', 'approved', 'confirmed'];

// One clear sentence about this person and this event: { tone, text }
function registrationMessage(event) {
  const my = event.my;
  const status = my.registration?.status;

  if (event.kind === 'umbrella') return { tone: 'info', text: 'Register for the individual events listed on this page.' };
  if (!event.registration_required) return { tone: 'info', text: 'No registration needed. Just come along.' };
  if (LIVE_STATUSES.includes(status)) return { tone: 'success', text: REGISTRATION_LABELS[status] };
  if (status === 'rejected') {
    return { tone: 'danger', text: `Your registration was not approved: ${my.registration.rejection_reason}` };
  }
  if (event.status === 'cancelled') return { tone: 'danger', text: 'This event was cancelled.' };
  if (event.lifecycle === 'registration_closed') {
    return { tone: 'muted', text: `Registration closed on ${formatDateTime(event.registration_deadline)}.` };
  }
  if (event.lifecycle === 'ongoing') return { tone: 'muted', text: 'This event is happening now.' };
  if (event.lifecycle === 'completed') return { tone: 'muted', text: 'This event has finished.' };
  if (my.eligible === false) {
    const { grid, departments } = describeEligibility(event.eligibility);
    return { tone: 'muted', text: `You're not eligible. It's open to ${grid} (${departments}).` };
  }
  if (my.clash_with.length > 0) {
    return { tone: 'warning', text: `It overlaps with ${my.clash_with.map((c) => c.title).join(', ')}, which you've registered for.` };
  }
  if (seatsLeft(event) === 0) return { tone: 'danger', text: 'All seats are taken.' };
  return { tone: 'success', text: `Registration is open until ${formatDateTime(event.registration_deadline)}.` };
}

export default function EventDetail() {
  const { id } = useParams();
  const { data: event, loading, error } = useLoad(`/events/${id}`);
  const [downloadError, setDownloadError] = useState('');

  if (loading && !event) return <Loading />;
  if (!event) return <Alert variant="danger">{error || 'Event not found'}</Alert>;

  const poster = uploadUrl(event.poster_path);
  const message = registrationMessage(event);
  const { grid, departments } = describeEligibility(event.eligibility);
  const kindText =
    event.kind === 'umbrella'
      ? `Umbrella event · ${event.fest_name}`
      : `${event.type_name} · ${event.club_name || event.fest_name || SCOPE_LABELS[event.scope]}`;

  async function handleDownload(file) {
    setDownloadError('');
    try {
      await downloadFile(`/files/${file.id}/download`, file.original_name);
    } catch {
      setDownloadError(`Could not download ${file.title}. Please try again.`);
    }
  }

  return (
    <>
      <Link to={event.parent_event_id ? `/events/${event.parent_event_id}` : '/events'} className="small d-inline-block mb-2">
        ← {event.parent_title ?? 'All events'}
      </Link>

      {poster && <img src={poster} alt="" className="detail-poster" />}

      <div className="page-header d-flex flex-wrap gap-3 justify-content-between align-items-end">
        <div>
          <div className="small text-muted mb-1">{kindText}</div>
          <h1>{event.title}</h1>
          <div className="d-flex flex-wrap gap-1 mt-2">
            <StatusBadge lifecycle={event.lifecycle} />
            <BadgeList badges={getEventBadges(event)} />
          </div>
        </div>
        {event.my.can_manage && (
          <Button as={Link} to={`/organize/events/${event.id}`} variant="outline-primary">Manage</Button>
        )}
      </div>

      <Row className="g-4">
        <Col lg={8}>
          {event.description && (
            <Card body className="mb-4">
              <div className="section-label">About</div>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{event.description}</p>
            </Card>
          )}

          {event.sessions.length > 0 && (
            <Card className="mb-4">
              <Card.Body className="pb-0">
                <div className="section-label">Schedule</div>
              </Card.Body>
              <ListGroup variant="flush">
                {event.sessions.map((s) => (
                  <ListGroup.Item key={s.id} className="d-flex justify-content-between flex-wrap gap-2">
                    <span>{s.title}</span>
                    <span className="small text-muted">{formatRange(s.start_time, s.end_time)}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card>
          )}

          {event.files.length > 0 && (
            <Card className="mb-4">
              <Card.Body className="pb-0">
                <div className="section-label">Files</div>
                {downloadError && <Alert variant="danger" className="py-2">{downloadError}</Alert>}
              </Card.Body>
              <ListGroup variant="flush">
                {event.files.map((f) => (
                  <ListGroup.Item key={f.id} className="d-flex justify-content-between align-items-center gap-2">
                    <span>
                      {f.title}
                      <span className="small text-muted ms-2">{Math.ceil(f.size_bytes / 1024)} KB</span>
                    </span>
                    <Button size="sm" variant="outline-primary" onClick={() => handleDownload(f)}>Download</Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card>
          )}

          {event.kind === 'umbrella' &&
            CHILD_GROUPS.map((group) => {
              const items = event.children.filter(group.match);
              if (items.length === 0) return null;
              return (
                <section key={group.title} className="mb-4">
                  <div className="section-label">{group.title}</div>
                  <Row className="g-4">
                    {items.map((child) => (
                      <Col key={child.id} md={6}>
                        <EventCard event={child} />
                      </Col>
                    ))}
                  </Row>
                </section>
              );
            })}
          {event.kind === 'umbrella' && event.children.length === 0 && (
            <p className="text-muted">Its events haven't been published yet.</p>
          )}
        </Col>

        <Col lg={4}>
          <div className="sticky-panel">
            <Card body className="mb-4">
              <div className="section-label">Your registration</div>
              <p className={`mb-0 soft-badge tone-${message.tone} d-block text-wrap`} style={{ whiteSpace: 'normal', fontSize: '0.9rem' }}>
                {message.text}
              </p>
              {event.kind === 'normal' && Boolean(event.registration_required) && (
                <p className="small text-muted mt-3 mb-0">Registering opens in the next update.</p>
              )}
            </Card>

            <Card body>
              <div className="section-label">Details</div>
              <dl className="info-list">
                <dt>When</dt>
                <dd>{formatRange(event.start_time, event.end_time)}</dd>
                <dt>Where</dt>
                <dd>{event.venue_name || 'To be announced'}</dd>
                <dt>Organizer</dt>
                <dd>{event.club_name || event.fest_name || event.organizer_name}</dd>
                {event.parent_event_id && (
                  <>
                    <dt>Part of</dt>
                    <dd><Link to={`/events/${event.parent_event_id}`}>{event.parent_title}</Link></dd>
                  </>
                )}
                {Boolean(event.registration_required) && (
                  <>
                    <dt>Fee</dt>
                    <dd>{Number(event.fee) > 0 ? `₹${event.fee}` : 'Free'}</dd>
                    <dt>Seats</dt>
                    <dd>{event.capacity ? `${seatsLeft(event)} of ${event.capacity} left` : 'No limit'}</dd>
                    <dt>Who</dt>
                    <dd>
                      {grid}
                      <div className="small text-muted">{departments}</div>
                    </dd>
                  </>
                )}
              </dl>
            </Card>
          </div>
        </Col>
      </Row>
    </>
  );
}

*/

import { useState } from 'react';
import { Alert, Button, Card, Col, ListGroup, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client';
import AnnouncementList from '../../components/AnnouncementList';
import BadgeList from '../../components/BadgeList';
import ConfirmModal from '../../components/ConfirmModal';
import EventCard from '../../components/EventCard';
import FeedbackForm from '../../components/FeedbackForm';
import Loading from '../../components/Loading';
import PayButton from '../../components/PayButton';
import StatusBadge from '../../components/StatusBadge';
import TeamPanel from '../../components/TeamPanel';
import { uploadUrl } from '../../utils/assets';
import { canOpenInBrowser, openFile } from '../../utils/download';
import { fileTypeLabel, formatFileSize } from '../../utils/files';
import { getEventBadges, seatsLeft } from '../../utils/eventBadges';
import { describeEligibility, formatDateTime, formatRange, REGISTRATION_LABELS, SCOPE_LABELS } from '../../utils/format';
import useLoad from '../../utils/useLoad';

const CHILD_GROUPS = [
  { title: 'Open for registration', match: (c) => c.lifecycle === 'registration_open' },
  { title: 'Happening now', match: (c) => c.lifecycle === 'ongoing' },
  { title: 'Coming up', match: (c) => ['registration_closed', 'upcoming'].includes(c.lifecycle) },
  { title: 'Completed', match: (c) => c.lifecycle === 'completed' },
];

const LIVE_STATUSES = ['pending', 'approved', 'confirmed'];

function isRegistrable(event) {
  return event.kind === 'normal' && Boolean(event.registration_required);
}

// One clear sentence about this person and this event: { tone, text }
function registrationMessage(event) {
  const my = event.my;
  const status = my.registration?.status;

  if (event.kind === 'umbrella') return { tone: 'info', text: 'Register for the individual events listed on this page.' };
  if (!event.registration_required) return { tone: 'info', text: 'No registration needed. Just come along.' };
  if (my.can_manage) return { tone: 'info', text: 'You organize this event, so you cannot register for it.' };
  if (LIVE_STATUSES.includes(status)) return { tone: status === 'confirmed' ? 'success' : 'info', text: REGISTRATION_LABELS[status] };
  if (status === 'rejected') {
    return { tone: 'danger', text: `Your registration was not approved: ${my.registration.rejection_reason}` };
  }
  if (event.status === 'cancelled') return { tone: 'danger', text: 'This event was cancelled.' };
  if (event.lifecycle === 'registration_closed') {
    return { tone: 'muted', text: `Registration closed on ${formatDateTime(event.registration_deadline)}.` };
  }
  if (event.lifecycle === 'ongoing') return { tone: 'muted', text: 'This event is happening now.' };
  if (event.lifecycle === 'completed') return { tone: 'muted', text: 'This event has finished.' };
  if (my.eligible === false) {
    const { grid, departments } = describeEligibility(event.eligibility);
    return { tone: 'muted', text: `You're not eligible. It's open to ${grid} (${departments}).` };
  }
  if (my.clash_with.length > 0) {
    return { tone: 'warning', text: `It overlaps with ${my.clash_with.map((c) => c.title).join(', ')}, which you've registered for.` };
  }
  if (seatsLeft(event) === 0) return { tone: 'danger', text: 'All seats are taken.' };
  const teamNote = event.is_team_event ? ` Register as a team of ${event.team_min}–${event.team_max}.` : '';
  return { tone: 'success', text: `Registration is open until ${formatDateTime(event.registration_deadline)}.${teamNote}` };
}

function RegistrationPanel({ event, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const my = event.my;
  const status = my.registration?.status;
  const message = registrationMessage(event);
  const isTeam = Boolean(event.is_team_event);

  const canRegister =
    !isTeam &&
    isRegistrable(event) &&
    !my.can_manage &&
    event.lifecycle === 'registration_open' &&
    !LIVE_STATUSES.includes(status) &&
    my.eligible === true &&
    my.clash_with.length === 0 &&
    seatsLeft(event) !== 0;
  const canCancel = !isTeam && LIVE_STATUSES.includes(status) && ['registration_open', 'registration_closed'].includes(event.lifecycle);

  async function handleRegister() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/events/${event.id}/registrations`);
      setNotice(res.data.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(`/registrations/${my.registration.id}/cancel`);
      setNotice('Your registration was cancelled.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      setShowCancel(false);
      onChanged();
    }
  }

  return (
    <Card body className="mb-4">
      <div className="section-label">Your registration</div>
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      <p className={`soft-badge tone-${message.tone} d-block mb-0`} style={{ whiteSpace: 'normal', fontSize: '0.9rem' }}>
        {message.text}
      </p>

      {canRegister && (
        <Button className="w-100 mt-3" onClick={handleRegister} disabled={busy}>
          {busy ? 'Registering…' : Number(event.fee) > 0 ? `Register · ₹${event.fee}` : 'Register'}
        </Button>
      )}
      {canRegister && !event.auto_approve && (
        <p className="small text-muted mt-2 mb-0">An organizer reviews each registration.</p>
      )}
      {!isTeam && status === 'approved' && (
        <PayButton registrationId={my.registration.id} amount={event.fee} title={event.title} onDone={onChanged} className="w-100 mt-3" />
      )}
      {canCancel && (
        <Button variant="link" className="text-danger p-0 mt-3" onClick={() => setShowCancel(true)} disabled={busy}>
          Cancel my registration
        </Button>
      )}

      {isTeam && isRegistrable(event) && !my.can_manage && <TeamPanel event={event} onChanged={onChanged} />}

      <ConfirmModal
        show={showCancel}
        title="Cancel registration"
        confirmLabel="Cancel registration"
        variant="danger"
        busy={busy}
        onConfirm={handleCancel}
        onHide={() => setShowCancel(false)}
      >
        Give up your place at <strong>{event.title}</strong>? Your seat goes to someone else.
      </ConfirmModal>
    </Card>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const { data: event, loading, error, reload } = useLoad(`/events/${id}`);
  const [downloadError, setDownloadError] = useState('');

  if (loading && !event) return <Loading />;
  if (!event) return <Alert variant="danger">{error || 'Event not found'}</Alert>;

  const poster = uploadUrl(event.poster_path);
  const { grid, departments } = describeEligibility(event.eligibility);
  const kindText =
    event.kind === 'umbrella'
      ? `Umbrella event · ${event.fest_name}`
      : `${event.type_name} · ${event.club_name || event.fest_name || SCOPE_LABELS[event.scope]}`;

  async function handleOpen(file) {
    setDownloadError('');
    try {
      await openFile(`/files/${file.id}/download`, file.original_name, file.mime_type);
    } catch {
      setDownloadError(`Could not open ${file.title}. Please try again.`);
    }
  }

  return (
    <>
      <Link to={event.parent_event_id ? `/events/${event.parent_event_id}` : '/events'} className="small d-inline-block mb-2">
        ← {event.parent_title ?? 'All events'}
      </Link>

      {poster && <img src={poster} alt="" className="detail-poster" />}

      <div className="page-header d-flex flex-wrap gap-3 justify-content-between align-items-end">
        <div>
          <div className="small text-muted mb-1">{kindText}</div>
          <h1>{event.title}</h1>
          <div className="d-flex flex-wrap gap-1 mt-2">
            <StatusBadge lifecycle={event.lifecycle} />
            <BadgeList badges={getEventBadges(event)} />
          </div>
        </div>
        {event.my.can_manage && (
          <Button as={Link} to={`/organize/events/${event.id}`} variant="outline-primary">Manage</Button>
        )}
      </div>

      <Row className="g-4">
        <Col lg={8}>
          <AnnouncementList eventId={event.id} hideWhenEmpty />

          {event.description && (
            <Card body className="mb-4">
              <div className="section-label">About</div>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{event.description}</p>
            </Card>
          )}

          {event.sessions.length > 0 && (
            <Card className="mb-4">
              <Card.Body className="pb-0">
                <div className="section-label">Schedule</div>
              </Card.Body>
              <ListGroup variant="flush">
                {event.sessions.map((s) => (
                  <ListGroup.Item key={s.id} className="d-flex justify-content-between flex-wrap gap-2">
                    <span>{s.title}</span>
                    <span className="small text-muted">{formatRange(s.start_time, s.end_time)}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card>
          )}

          {event.files.length > 0 && (
            <Card className="mb-4">
              <Card.Body className="pb-0">
                <div className="section-label">Files</div>
                {downloadError && <Alert variant="danger" className="py-2">{downloadError}</Alert>}
              </Card.Body>
              <ListGroup variant="flush">
                {event.files.map((f) => (
                  <ListGroup.Item key={f.id} className="d-flex justify-content-between align-items-center gap-2">
                    <span>
                      {f.title}
                      <span className="small text-muted ms-2">
                        {fileTypeLabel(f)} · {formatFileSize(f.size_bytes)}
                      </span>
                    </span>
                    <Button size="sm" variant="outline-primary" onClick={() => handleOpen(f)}>
                      {canOpenInBrowser(f.mime_type) ? 'Open' : 'Download'}
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card>
          )}

          {event.kind === 'umbrella' &&
            CHILD_GROUPS.map((group) => {
              const items = event.children.filter(group.match);
              if (items.length === 0) return null;
              return (
                <section key={group.title} className="mb-4">
                  <div className="section-label">{group.title}</div>
                  <Row className="g-4">
                    {items.map((child) => (
                      <Col key={child.id} md={6}>
                        <EventCard event={child} />
                      </Col>
                    ))}
                  </Row>
                </section>
              );
            })}
          {event.kind === 'umbrella' && event.children.length === 0 && (
            <p className="text-muted">Its events haven't been published yet.</p>
          )}
        </Col>

        <Col lg={4}>
          <div className="sticky-panel">
            <RegistrationPanel event={event} onChanged={reload} />

            {event.lifecycle === 'completed' && event.my.registration?.status === 'confirmed' && (
              <Card body className="mb-4">
                <div className="section-label">Your feedback</div>
                {event.my.feedback_given ? (
                  <p className="mb-0 text-muted">Thanks for your feedback.</p>
                ) : (
                  <FeedbackForm eventId={event.id} onDone={reload} />
                )}
              </Card>
            )}

            <Card body>
              <div className="section-label">Details</div>
              <dl className="info-list">
                <dt>When</dt>
                <dd>{formatRange(event.start_time, event.end_time)}</dd>
                <dt>Where</dt>
                <dd>{event.venue_name || 'To be announced'}</dd>
                <dt>Organizer</dt>
                <dd>{event.club_name || event.fest_name || event.organizer_name}</dd>
                {event.parent_event_id && (
                  <>
                    <dt>Part of</dt>
                    <dd><Link to={`/events/${event.parent_event_id}`}>{event.parent_title}</Link></dd>
                  </>
                )}
                {Boolean(event.registration_required) && (
                  <>
                    <dt>Fee</dt>
                    <dd>
                      {Number(event.fee) > 0 ? `₹${event.fee}` : 'Free'}
                      {event.is_team_event && Number(event.fee) > 0 ? ' per team' : ''}
                    </dd>
                    <dt>Seats</dt>
                    <dd>
                      {event.capacity ? `${seatsLeft(event)} of ${event.capacity} left` : 'No limit'}
                      {event.is_team_event ? ' (teams)' : ''}
                    </dd>
                    {event.is_team_event && (
                      <>
                        <dt>Team size</dt>
                        <dd>{event.team_min}–{event.team_max}</dd>
                      </>
                    )}
                    <dt>Who</dt>
                    <dd>
                      {grid}
                      <div className="small text-muted">{departments}</div>
                    </dd>
                  </>
                )}
              </dl>
            </Card>
          </div>
        </Col>
      </Row>
    </>
  );
}