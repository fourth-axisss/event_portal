import { Alert, Button, Tab, Tabs } from 'react-bootstrap';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import Loading from '../../../components/Loading';
import StatusBadge from '../../../components/StatusBadge';
import useLoad from '../../../utils/useLoad';
import { formatRange, SCOPE_LABELS } from '../../../utils/format';
import OverviewTab from './OverviewTab';
import SessionsTab from './SessionsTab';

export default function EventControl() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: event, loading, error, reload } = useLoad(`/events/${id}`);

  if (loading && !event) return <Loading />;
  if (!event) return <Alert variant="danger">{error || 'Event not found'}</Alert>;

  const activeTab = searchParams.get('tab') || 'overview';
  const canManage = event.my.can_manage;
  const editable = canManage && event.status !== 'cancelled' && event.lifecycle !== 'completed';
  const belongsTo =
    event.kind === 'umbrella'
      ? `Umbrella event · ${event.fest_name}`
      : `${SCOPE_LABELS[event.scope]}${event.club_name ? ` · ${event.club_name}` : event.fest_name ? ` · ${event.fest_name}` : ''}`;

  return (
    <>
      <Link to="/organize" className="small d-inline-block mb-2">← All my events</Link>

      <div className="page-header d-flex flex-wrap gap-3 justify-content-between align-items-end">
        <div>
          <h1>{event.title}</h1>
          <p className="d-flex flex-wrap gap-2 align-items-center">
            <StatusBadge lifecycle={event.lifecycle} />
            <span>{belongsTo}</span>
            <span>·</span>
            <span>{formatRange(event.start_time, event.end_time)}</span>
          </p>
        </div>
        {editable && (
          <Button as={Link} to={`/organize/events/${event.id}/edit`} variant="outline-primary">Edit details</Button>
        )}
      </div>

      {location.state?.message && <Alert variant="success">{location.state.message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}
      {event.my.permissions.length === 0 && (
        <Alert variant="info">You can view this event but do not manage it.</Alert>
      )}

      <Tabs
        variant="underline"
        className="section-tabs mb-4"
        activeKey={activeTab}
        onSelect={(key) => setSearchParams({ tab: key }, { replace: true })}
      >
        <Tab eventKey="overview" title="Overview">
          <OverviewTab event={event} onChanged={reload} />
        </Tab>
        {canManage && event.kind === 'normal' && (
          <Tab eventKey="sessions" title={`Sessions (${event.sessions.length})`}>
            <SessionsTab event={event} onChanged={reload} />
          </Tab>
        )}
      </Tabs>
    </>
  );
}