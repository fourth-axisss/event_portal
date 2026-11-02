import { Badge, Button, Card, Col, ListGroup, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useLoad from '../../utils/useLoad';
import { formatDateTime } from '../../utils/format';
import { POSITION_LABELS, ROLES } from '../../utils/constants';

const LIVE_STATUSES = ['pending', 'approved', 'confirmed'];
const NOT_OVER = ['registration_open', 'registration_closed', 'upcoming', 'ongoing'];

function ParticipantSummary() {
  const { data: regs } = useLoad('/me/registrations');
    const { data: teams } = useLoad('/me/teams');
  if (!regs) return null;

  const active = regs.filter((r) => r.event_status !== 'cancelled');
    const attention = [
    ...(teams ?? [])
      .filter((t) => t.my_status === 'invited')
      .map((t) => ({ id: `inv-${t.id}`, eventId: t.event_id, text: `${t.leader_name} invited you to team ${t.name} for ${t.title}` })),
    ...active
      .filter((r) => r.status === 'approved' && NOT_OVER.includes(r.lifecycle))
      .map((r) => ({ id: `pay-${r.id}`, eventId: r.event_id, text: `Pay ₹${r.fee} to confirm your seat at ${r.title}` })),
    ...active
      .filter((r) => r.status === 'pending' && NOT_OVER.includes(r.lifecycle))
      .map((r) => ({ id: `wait-${r.id}`, eventId: r.event_id, text: `Waiting for the organizer to approve ${r.title}` })),
    ...active
      .filter((r) => r.status === 'rejected' && NOT_OVER.includes(r.lifecycle))
      .map((r) => ({ id: `rej-${r.id}`, eventId: r.event_id, text: `Not approved for ${r.title}: ${r.rejection_reason}` })),
    ...active
      .filter((r) => r.status === 'confirmed' && r.lifecycle === 'completed' && !r.feedback_given)
      .map((r) => ({ id: `fb-${r.id}`, eventId: r.event_id, text: `Tell the organizers how ${r.title} went` })),
  ];

  const comingUp = [...active.filter((r) => LIVE_STATUSES.includes(r.status) && NOT_OVER.includes(r.lifecycle))]
    .reverse()
    .slice(0, 4);

  return (
    <Row className="g-4 mb-4">
      <Col lg={6}>
        <Card className="h-100">
          <Card.Body className="pb-0">
            <div className="section-label">Needs your attention</div>
          </Card.Body>
          {attention.length === 0 ? (
            <Card.Body className="pt-0 text-muted">You're all caught up.</Card.Body>
          ) : (
            <ListGroup variant="flush">
              {attention.map((a) => (
                <ListGroup.Item key={a.id} action as={Link} to={`/events/${a.eventId}`}>
                  {a.text}
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card>
      </Col>
      <Col lg={6}>
        <Card className="h-100">
          <Card.Body className="pb-0 d-flex justify-content-between">
            <div className="section-label">Coming up</div>
            <Link to="/me/registrations" className="small">All registrations</Link>
          </Card.Body>
          {comingUp.length === 0 ? (
            <Card.Body className="pt-0 text-muted">
              Nothing yet. <Link to="/events">Browse events</Link>.
            </Card.Body>
          ) : (
            <ListGroup variant="flush">
              {comingUp.map((r) => (
                <ListGroup.Item key={r.id} action as={Link} to={`/events/${r.event_id}`}>
                  <div className="fw-semibold">{r.title}</div>
                  <div className="small text-muted">{formatDateTime(r.start_time)}</div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card>
      </Col>
    </Row>
  );
}

function OrganizerSummary() {
  const { data: events } = useLoad('/organize/events');
  if (!events) return null;

  const waiting = events.filter((e) => e.pending_count > 0);
  const totalPending = waiting.reduce((sum, e) => sum + e.pending_count, 0);
  const drafts = events.filter((e) => e.status === 'draft').length;

  return (
    <Card className="mb-4">
      <Card.Body className="d-flex flex-wrap gap-3 justify-content-between align-items-center">
        <div>
          <div className="section-label mb-1">Organizing</div>
          <div>
            <strong>{totalPending}</strong> registration{totalPending === 1 ? '' : 's'} waiting for approval
            {drafts > 0 && <span className="text-muted"> · {drafts} unpublished draft{drafts === 1 ? '' : 's'}</span>}
          </div>
        </div>
        <Button as={Link} to="/organize" variant="outline-primary" size="sm">Go to Organize</Button>
      </Card.Body>
      {waiting.length > 0 && (
        <ListGroup variant="flush">
          {waiting.map((e) => (
            <ListGroup.Item key={e.id} action as={Link} to={`/organize/events/${e.id}?tab=registrations`}>
              <Badge bg="primary" className="me-2">{e.pending_count}</Badge>
              {e.title}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Card>
  );
}

function AdminShortcuts() {
  const links = [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/fests', label: 'Fests & clubs' },
    { to: '/admin/departments', label: 'Departments & venues' },
    { to: '/admin/event-types', label: 'Event types' },
  ];
  return (
    <Card body className="mb-4">
      <div className="section-label">Administration</div>
      <div className="d-flex flex-wrap gap-2">
        {links.map((l) => (
          <Button key={l.to} as={Link} to={l.to} variant="outline-primary" size="sm">{l.label}</Button>
        ))}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user, capabilities } = useAuth();
  const isAdmin = user.role === ROLES.ADMIN;
  const positions = capabilities?.positions || [];
  const subtitle = [
    user.role.charAt(0).toUpperCase() + user.role.slice(1),
    user.department_code,
    user.program && `${user.program}, Year ${user.year}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="page-header">
        <h1>Welcome, {user.name}</h1>
        <p>{subtitle}</p>
      </div>

      {isAdmin && <AdminShortcuts />}
      {!isAdmin && <ParticipantSummary />}
      {capabilities?.can_organize && <OrganizerSummary />}

      <Row className="g-4">
        <Col md={6}>
          <Card body>
            <div className="section-label">Profile</div>
            <dl className="info-list">
              <dt>Email</dt>
              <dd>{user.email}</dd>
              {user.roll_no && (
                <>
                  <dt>Roll no.</dt>
                  <dd>{user.roll_no}</dd>
                </>
              )}
              {user.department_name && (
                <>
                  <dt>Department</dt>
                  <dd>{user.department_name}</dd>
                </>
              )}
              <dt>Phone</dt>
              <dd>{user.phone || '—'}</dd>
            </dl>
          </Card>
        </Col>
        <Col md={6}>
          <Card body>
            <div className="section-label">Organizer roles</div>
            {positions.length > 0 ? (
              <ul className="list-unstyled mb-0">
                {positions.map((p) => (
                  <li key={p.id} className="mb-2">
                    <span className="tag me-2">{POSITION_LABELS[p.position_type]}</span>
                    {p.club_name ? `${p.club_name}, ${p.fest_name}` : p.fest_name}
                  </li>
                ))}
              </ul>
            ) : isAdmin ? (
              <p className="mb-0">You manage users, fests, clubs and master data from the Admin panel.</p>
            ) : user.role === ROLES.FACULTY ? (
              <p className="mb-0">As faculty you can create and manage faculty events.</p>
            ) : (
              <p className="mb-0 text-muted">You don't hold any organizer roles.</p>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}



/*import { Card, Col, Row } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { POSITION_LABELS, ROLES } from '../../utils/constants';

export default function Dashboard() {
  const { user, capabilities } = useAuth();
  const positions = capabilities?.positions || [];
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const subtitle = [roleLabel, user.department_code, user.program && `${user.program}, Year ${user.year}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="page-header">
        <h1>Welcome, {user.name}</h1>
        <p>{subtitle}</p>
      </div>

      <Row className="g-4">
        <Col md={6}>
          <Card body>
            <div className="section-label">Profile</div>
            <dl className="info-list">
              <dt>Email</dt>
              <dd>{user.email}</dd>
              {user.roll_no && (
                <>
                  <dt>Roll no.</dt>
                  <dd>{user.roll_no}</dd>
                </>
              )}
              {user.department_name && (
                <>
                  <dt>Department</dt>
                  <dd>{user.department_name}</dd>
                </>
              )}
              <dt>Phone</dt>
              <dd>{user.phone || '—'}</dd>
            </dl>
          </Card>
        </Col>

        <Col md={6}>
          <Card body>
            <div className="section-label">Organizer roles</div>
            {positions.length > 0 ? (
              <ul className="list-unstyled mb-0">
                {positions.map((p) => (
                  <li key={p.id} className="mb-2">
                    <span className="tag me-2">{POSITION_LABELS[p.position_type]}</span>
                    {p.club_name ? `${p.club_name}, ${p.fest_name}` : p.fest_name}
                  </li>
                ))}
              </ul>
            ) : user.role === ROLES.ADMIN ? (
              <p className="mb-0">You manage users, fests, clubs and master data from the Admin panel.</p>
            ) : user.role === ROLES.FACULTY ? (
              <p className="mb-0">As faculty you can create and manage faculty events.</p>
            ) : (
              <p className="mb-0 text-muted">You don't hold any organizer roles.</p>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}


*/