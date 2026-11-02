import { Alert, Button, Tab, Tabs } from 'react-bootstrap';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import Loading from '../../../components/Loading';
import StatusBadge from '../../../components/StatusBadge';
import useLoad from '../../../utils/useLoad';
import { formatRange, SCOPE_LABELS } from '../../../utils/format';
import { PERMISSION_LABELS } from '../../../utils/constants';
import OverviewTab from './OverviewTab';
import SessionsTab from './SessionsTab';
import RegistrationsTab from './RegistrationsTab';
import AttendanceTab from './AttendanceTab';
import CertificatesTab from './CertificatesTab';
import FeedbackTab from './FeedbackTab';
import DelegatesTab from './DelegatesTab';

export default function EventControl() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: event, loading, error, reload } = useLoad(`/events/${id}`);

  if (loading && !event) return <Loading />;
  if (!event) return <Alert variant="danger">{error || 'Event not found'}</Alert>;

  const permissions = event.my.permissions;
  const canManage = event.my.can_manage;
  const takesRegistrations = event.kind === 'normal' && Boolean(event.registration_required);
  const show = {
    registrations: takesRegistrations && permissions.includes('registrations'),
    attendance: takesRegistrations && permissions.includes('attendance'),
    certificates: takesRegistrations && permissions.includes('certificates'),
    feedback: takesRegistrations && canManage,
    delegates: canManage && event.kind === 'normal',
    sessions: canManage && event.kind === 'normal',
  };
  const firstAllowed = canManage ? 'overview' : ['registrations', 'attendance', 'certificates'].find((t) => show[t]) || 'overview';
  const activeTab = searchParams.get('tab') || firstAllowed;
  const editable = canManage && event.status !== 'cancelled' && event.lifecycle !== 'completed';
  const isDelegate = !canManage && permissions.length > 0;
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
        <div className="d-flex gap-2">
          <Button as={Link} to={`/events/${event.id}`} variant="link">View as participant</Button>
          {editable && (
            <Button as={Link} to={`/organize/events/${event.id}/edit`} variant="outline-primary">Edit details</Button>
          )}
        </div>
      </div>

      {location.state?.message && <Alert variant="success">{location.state.message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}
      {permissions.length === 0 && <Alert variant="info">You can view this event but do not manage it.</Alert>}
      {isDelegate && (
        <Alert variant="info">
          You're helping with this event: {permissions.map((p) => PERMISSION_LABELS[p]).join(', ')}.
        </Alert>
      )}

      <Tabs
        variant="underline"
        className="section-tabs mb-4"
        activeKey={activeTab}
        onSelect={(key) => setSearchParams({ tab: key }, { replace: true })}
        mountOnEnter
      >
        <Tab eventKey="overview" title="Overview">
          <OverviewTab event={event} onChanged={reload} />
        </Tab>
        {show.registrations && (
          <Tab eventKey="registrations" title="Registrations">
            <RegistrationsTab event={event} onChanged={reload} />
          </Tab>
        )}
        {show.attendance && (
          <Tab eventKey="attendance" title="Attendance">
            <AttendanceTab event={event} />
          </Tab>
        )}
        {show.certificates && (
          <Tab eventKey="certificates" title="Certificates">
            <CertificatesTab event={event} />
          </Tab>
        )}
        {show.feedback && (
          <Tab eventKey="feedback" title="Feedback">
            <FeedbackTab event={event} />
          </Tab>
        )}
        {show.delegates && (
          <Tab eventKey="delegates" title="Delegates">
            <DelegatesTab event={event} />
          </Tab>
        )}
        {show.sessions && (
          <Tab eventKey="sessions" title={`Sessions (${event.sessions.length})`}>
            <SessionsTab event={event} onChanged={reload} />
          </Tab>
        )}
      </Tabs>
    </>
  );
}

