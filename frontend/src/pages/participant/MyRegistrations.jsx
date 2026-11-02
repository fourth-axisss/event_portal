import { useState } from 'react';
import { Alert, Button, Card, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';
import Loading from '../../components/Loading';
import StatusTrail from '../../components/StatusTrail';
import useLoad from '../../utils/useLoad';
import { STATUS_TONES } from '../../utils/eventBadges';
import { formatRange, REGISTRATION_LABELS } from '../../utils/format';



//import PayButton from '../../components/PayButton';


import PayButton from '../../components/PayButton';

const NOT_STARTED = ['registration_open', 'registration_closed', 'upcoming'];
const LIVE_STATUSES = ['pending', 'approved', 'confirmed'];

function isUpcoming(r) {
  return [...NOT_STARTED, 'ongoing'].includes(r.lifecycle) && r.event_status !== 'cancelled' && r.status !== 'cancelled';
}

export default function MyRegistrations() {
  const { data, loading, error, reload } = useLoad('/me/registrations');
  const [view, setView] = useState('upcoming');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  async function handleCancel() {
    setBusy(true);
    setActionError('');
    try {
      await api.post(`/registrations/${cancelTarget.id}/cancel`);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
      setCancelTarget(null);
    }
  }

  if (loading && !data) return <Loading />;

  const upcoming = [...(data ?? []).filter(isUpcoming)].reverse(); // soonest first
  const past = (data ?? []).filter((r) => !isUpcoming(r)); // newest first
  const items = view === 'upcoming' ? upcoming : past;

  return (
    <>
      <div className="page-header">
        <h1>My registrations</h1>
        <p>Track approvals, payments, attendance and certificates.</p>
      </div>

      <Nav variant="underline" className="section-tabs mb-4" activeKey={view} onSelect={setView}>
        <Nav.Link eventKey="upcoming">Upcoming ({upcoming.length})</Nav.Link>
        <Nav.Link eventKey="past">Past &amp; cancelled ({past.length})</Nav.Link>
      </Nav>

      {(error || actionError) && <Alert variant="danger">{error || actionError}</Alert>}

      {items.length === 0 && (
        <p className="text-muted">
          {view === 'upcoming' ? (
            <>Nothing coming up. <Link to="/events">Browse events</Link> to find something.</>
          ) : (
            'Nothing here yet.'
          )}
        </p>
      )}

      {items.map((r) => {
                const leadsOrSolo = !r.team_name || Boolean(r.is_team_leader);
        const canCancel = leadsOrSolo && LIVE_STATUSES.includes(r.status) && NOT_STARTED.slice(0, 2).includes(r.lifecycle);
        return (
          <Card body key={r.id} className="mb-3">
            <div className="d-flex flex-wrap gap-2 justify-content-between align-items-start">
              <div>
                <h2 className="h6 mb-1">
                  <Link to={`/events/${r.event_id}`}>{r.title}</Link>
                </h2>
                                <div className="small text-muted mb-2">
                  {formatRange(r.start_time, r.end_time)}
                  {r.venue_name && ` · ${r.venue_name}`}
                  {r.team_name && ` · Team ${r.team_name}${r.is_team_leader ? ' (leader)' : ''}`}
                </div>
              </div>
              <span className={`soft-badge tone-${r.event_status === 'cancelled' ? 'danger' : STATUS_TONES[r.status]}`}>
                {r.event_status === 'cancelled' ? 'Event cancelled' : REGISTRATION_LABELS[r.status]}
              </span>
            </div>

            {LIVE_STATUSES.includes(r.status) && r.event_status !== 'cancelled' && <StatusTrail registration={r} />}
            {r.status === 'rejected' && <p className="small text-danger mb-0">Reason: {r.rejection_reason}</p>}
            {r.event_status === 'cancelled' && r.cancel_reason && (
              <p className="small text-danger mb-0">Reason: {r.cancel_reason}</p>
            )}




                                    {r.status === 'approved' && r.event_status !== 'cancelled' && leadsOrSolo && (
              <div className="mt-2">
                <PayButton registrationId={r.id} amount={r.fee} title={r.title} onDone={reload} size="sm" />
              </div>
            )}

            {canCancel && (
              <Button variant="link" size="sm" className="text-danger p-0 mt-2" onClick={() => setCancelTarget(r)}>
                Cancel registration
              </Button>
            )}
          </Card>
        );
      })}

      <ConfirmModal
        show={cancelTarget !== null}
        title="Cancel registration"
        confirmLabel="Cancel registration"
        variant="danger"
        busy={busy}
        onConfirm={handleCancel}
        onHide={() => setCancelTarget(null)}
      >
        Give up your place at <strong>{cancelTarget?.title}</strong>?
      </ConfirmModal>
    </>
  );
}