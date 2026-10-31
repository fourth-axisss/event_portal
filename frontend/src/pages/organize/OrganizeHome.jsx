import { Alert, Badge, Button, Card, Table } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import useLoad from '../../utils/useLoad';
import { formatRange, SCOPE_LABELS } from '../../utils/format';

export default function OrganizeHome() {
  const location = useLocation();
  const { data: events, loading, error } = useLoad('/organize/events');
  const flash = location.state?.message;

  return (
    <>
      <div className="page-header d-flex flex-wrap gap-2 justify-content-between align-items-end">
        <div>
          <h1>Organize</h1>
          <p>Events you can manage, newest first.</p>
        </div>
        <Button as={Link} to="/organize/new">+ Create event</Button>
      </div>

      {flash && <Alert variant="success">{flash}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        {loading && !events ? (
          <Loading />
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Event</th>
                <th>When</th>
                <th>Status</th>
                <th>Registrations</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events?.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No events yet. Create your first one.
                  </td>
                </tr>
              )}
              {events?.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="fw-semibold">{e.title}</div>
                    <div className="small text-muted">
                      {e.kind === 'umbrella' ? 'Umbrella event' : `${e.type_name} · ${SCOPE_LABELS[e.scope]}`}
                      {e.club_name ? ` · ${e.club_name}` : e.fest_name ? ` · ${e.fest_name}` : ''}
                    </div>
                  </td>
                  <td className="small">{formatRange(e.start_time, e.end_time)}</td>
                  <td>
                    <StatusBadge lifecycle={e.lifecycle} />
                  </td>
                  <td>
                    {e.pending_count > 0 && <Badge bg="primary" className="me-2">{e.pending_count} pending</Badge>}
                    <span className="small text-muted">{e.confirmed_count} confirmed</span>
                  </td>
                  <td className="text-end">
                    <Button as={Link} to={`/organize/events/${e.id}/edit`} size="sm" variant="link">
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}