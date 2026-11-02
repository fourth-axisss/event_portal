import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../../api/client';
import ConfirmModal from '../../../components/ConfirmModal';
import Loading from '../../../components/Loading';
import StudentPickerModal from '../../../components/StudentPickerModal';
import useLoad from '../../../utils/useLoad';
import { downloadFile } from '../../../utils/download';
import { CERTIFICATE_TYPE_LABELS, formatDateTime } from '../../../utils/format';





import { useAuth } from '../../../context/AuthContext';

export default function CertificatesTab({ event }) {
  const url = `/events/${event.id}/certificates`;
  const { data, loading, error, reload } = useLoad(url);


    const { user } = useAuth();


  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [showMerit, setShowMerit] = useState(false);
  const [awards, setAwards] = useState([{ user_id: '', rank_label: 'Winner' }]);
  const [showAppreciation, setShowAppreciation] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  if (loading && !data) return <Loading />;
  if (!data) return <Alert variant="danger">{error}</Alert>;

  const finished = data.lifecycle === 'completed';
  const toIssue = data.participants.filter((p) => p.qualifies && !p.issued.includes('participation'));

  const ruleText = {
    attendance: `Participants who attended at least ${data.min_attendance_percent}% of the ${data.total_sessions} session(s) qualify.`,
    completion: 'Participants you marked complete (Registrations tab) qualify.',
    none: 'This event gives no participation certificates. You can still award merit and appreciation certificates.',
  }[data.criteria];

  async function act(request) {
    setBusy(true);
    setNotice('');
    setActionError('');
    try {
      const res = await request();
      setNotice(res.data.message);
      reload();
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const issueParticipation = () => act(() => api.post(`${url}/issue`, { type: 'participation' }));

  async function issueMerit(e) {
    e.preventDefault();
    const list = awards.filter((a) => a.user_id).map((a) => ({ user_id: Number(a.user_id), rank_label: a.rank_label }));
    const ok = await act(() => api.post(`${url}/issue`, { type: 'merit', awards: list }));
    if (ok) {
      setShowMerit(false);
      setAwards([{ user_id: '', rank_label: 'Winner' }]);
    }
  }

  // Errors are thrown to StudentPickerModal, which shows them inside the modal
  async function issueAppreciation(student) {
    const res = await api.post(`${url}/issue`, { type: 'organizer', user_ids: [student.id] });
    setNotice(res.data.message);
    setShowAppreciation(false);
    reload();
  }

  async function revoke() {
    const ok = await act(() => api.delete(`/certificates/${revokeTarget.id}`));
    if (ok || !ok) setRevokeTarget(null);
  }

  function setAward(index, field, value) {
    setAwards((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  return (
    <>
      <p className="text-muted mb-2">{ruleText}</p>
      {!finished && (
        <Alert variant="info" className="py-2">
          You can issue certificates once the event has ended ({formatDateTime(event.end_time)}).
        </Alert>
      )}
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {actionError && <Alert variant="danger" className="py-2">{actionError}</Alert>}

      <div className="d-flex flex-wrap gap-2 mb-4">
        {data.criteria !== 'none' && (
          <Button disabled={!finished || busy || toIssue.length === 0} onClick={issueParticipation}>
            Issue participation certificates ({toIssue.length})
          </Button>
        )}
        <Button variant="outline-primary" disabled={!finished || busy || data.participants.length === 0} onClick={() => setShowMerit(true)}>
          Award merit…
        </Button>
        <Button variant="outline-primary" disabled={!finished || busy} onClick={() => setShowAppreciation(true)}>
          Appreciation…
        </Button>
      </div>

      <Row className="g-4">
        <Col lg={6}>
          <Card>
            <Card.Header><h2 className="h6 mb-0">Participants ({data.participants.length})</h2></Card.Header>
            <Table hover responsive size="sm" className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>{data.criteria === 'completion' ? 'Completed' : 'Attended'}</th>
                  <th>Qualifies</th>
                  <th>Has</th>
                </tr>
              </thead>
              <tbody>
                {data.participants.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">No confirmed participants.</td>
                  </tr>
                )}
                {data.participants.map((p) => (
                  <tr key={p.user_id}>
                    <td>
                      {p.name}
                      <div className="small text-muted">{p.roll_no || 'Faculty'}</div>
                    </td>
                    <td className="small">{data.criteria === 'completion' ? (p.completed ? '✓' : '—') : `${p.attended}/${p.total_sessions}`}</td>
                    <td>{p.qualifies ? <span className="soft-badge tone-success">Yes</span> : <span className="small text-muted">No</span>}</td>
                    <td className="small">{p.issued.map((t) => CERTIFICATE_TYPE_LABELS[t]).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={6}>
          <Card>
            <Card.Header><h2 className="h6 mb-0">Issued ({data.issued.length})</h2></Card.Header>
            <Table hover responsive size="sm" className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Certificate</th>
                  <th>Code</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.issued.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-3">None issued yet.</td>
                  </tr>
                )}
                {data.issued.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.name}
                      <div className="small text-muted">
                        {CERTIFICATE_TYPE_LABELS[c.type]}
                        {c.rank_label ? ` · ${c.rank_label}` : ''}
                      </div>
                    </td>
                    <td className="small text-muted">{c.certificate_code}</td>
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="link" onClick={() => downloadFile(`/certificates/${c.id}/pdf`, `${c.certificate_code}.pdf`)}>
                        PDF
                      </Button>
                      <Button size="sm" variant="link" className="text-danger" onClick={() => setRevokeTarget(c)}>
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      {/* Merit awards */}
      <Modal show={showMerit} onHide={() => setShowMerit(false)} centered>
        <Form onSubmit={issueMerit}>
          <Modal.Header closeButton>
            <Modal.Title as="h3" className="h5">Award merit certificates</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {awards.map((a, i) => (
              <Row className="g-2 mb-2" key={i}>
                <Col xs={7}>
                  <Form.Select
                    aria-label={`Participant ${i + 1}`}
                    value={a.user_id}
                    onChange={(e) => setAward(i, 'user_id', e.target.value)}
                    required
                  >
                    <option value="">Choose participant…</option>
                                       {data.participants
                      .filter((p) => event.my.can_manage || p.user_id !== user.id)
                      .map((p) => (
                        <option key={p.user_id} value={p.user_id}>{p.name}</option>
                      ))}
                  </Form.Select>
                </Col>
                <Col xs={5}>
                  <Form.Control
                    aria-label={`Rank ${i + 1}`}
                    value={a.rank_label}
                    onChange={(e) => setAward(i, 'rank_label', e.target.value)}
                    required
                    maxLength={50}
                  />
                </Col>
              </Row>
            ))}
            <Button
              size="sm"
              variant="link"
              className="p-0"
              onClick={() => setAwards((prev) => [...prev, { user_id: '', rank_label: prev.length === 1 ? 'Runner-up' : '' }])}
            >
              + Another award
            </Button>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowMerit(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Issuing…' : 'Issue'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Appreciation for volunteers / coordinators */}
      <StudentPickerModal
        show={showAppreciation}
        title="Certificate of appreciation"
        note="For volunteers and coordinators who helped run the event. They don't need to be registered."
        confirmLabel="Issue"
        onConfirm={issueAppreciation}
        onHide={() => setShowAppreciation(false)}
      />

      <ConfirmModal
        show={revokeTarget !== null}
        title="Revoke certificate"
        confirmLabel="Revoke"
        variant="danger"
        busy={busy}
        onConfirm={revoke}
        onHide={() => setRevokeTarget(null)}
      >
        Revoke {revokeTarget && CERTIFICATE_TYPE_LABELS[revokeTarget.type].toLowerCase()} certificate{' '}
        <strong>{revokeTarget?.certificate_code}</strong> of {revokeTarget?.name}? Its PDF stops working.
      </ConfirmModal>
    </>
  );
}