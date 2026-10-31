import { Card, Col, Row } from 'react-bootstrap';
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