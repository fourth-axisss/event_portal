import { useState } from 'react';
import { Alert, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Loading from '../../components/Loading';
import useLoad from '../../utils/useLoad';
import { downloadFile } from '../../utils/download';
import { CERTIFICATE_TYPE_LABELS, formatDate, formatRange } from '../../utils/format';

export default function MyCertificates() {
  const { data: certificates, loading, error } = useLoad('/me/certificates');
  const [busyId, setBusyId] = useState(null);
  const [failedId, setFailedId] = useState(null);

  async function handleDownload(c) {
    setBusyId(c.id);
    setFailedId(null);
    try {
      await downloadFile(`/certificates/${c.id}/pdf`, `${c.certificate_code}.pdf`);
    } catch {
      setFailedId(c.id);
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !certificates) return <Loading />;

  return (
    <>
      <div className="page-header">
        <h1>My certificates</h1>
        <p>Certificates appear here once an organizer issues them after the event.</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {certificates?.length === 0 && (
        <p className="text-muted">
          No certificates yet. Attend events and they'll show up here. <Link to="/me/registrations">See your registrations</Link>.
        </p>
      )}

      {certificates?.map((c) => (
        <Card body key={c.id} className="mb-3">
          <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center">
            <div>
              <span className="tag me-2">
                {CERTIFICATE_TYPE_LABELS[c.type]}
                {c.rank_label ? ` · ${c.rank_label}` : ''}
              </span>
              <h2 className="h6 d-inline">
                <Link to={`/events/${c.event_id}`}>{c.title}</Link>
              </h2>
              <div className="small text-muted mt-1">
                {formatRange(c.start_time, c.end_time)} · issued {formatDate(c.issued_at)} · {c.certificate_code}
              </div>
              {failedId === c.id && <div className="small text-danger mt-1">Download failed. Please try again.</div>}
            </div>
            <Button variant="outline-primary" onClick={() => handleDownload(c)} disabled={busyId === c.id}>
              {busyId === c.id ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>
        </Card>
      ))}
    </>
  );
}