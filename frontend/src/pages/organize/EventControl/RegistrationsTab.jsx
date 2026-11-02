import { useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Nav, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../../api/client';
import Loading from '../../../components/Loading';
import useLoad from '../../../utils/useLoad';
import { STATUS_TONES } from '../../../utils/eventBadges';
import { formatDateTime, REGISTRATION_LABELS } from '../../../utils/format';

//for group 8

import { useAuth } from '../../../context/AuthContext';

const FILTERS = ['all', 'pending', 'approved', 'confirmed', 'rejected', 'cancelled'];

export default function RegistrationsTab({ event, onChanged }) {
  const { data, loading, error, reload } = useLoad(`/events/${event.id}/registrations`);

    const { user } = useAuth();
  
  const [filter, setFilter] = useState(null); // null = choose automatically
  const [selected, setSelected] = useState([]); // registration ids
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  if (loading && !data) return <Loading />;
  if (!data) return <Alert variant="danger">{error}</Alert>;

  const all = data.registrations;
  const activeFilter = filter ?? (data.counts.pending > 0 ? 'pending' : 'all');
  const rows = activeFilter === 'all' ? all : all.filter((r) => r.status === activeFilter);
  const paidEvent = Number(data.fee) > 0;
  const canComplete = event.my.permissions.includes('certificates') && data.certificate_criteria === 'completion';
  const showContact = all.some((r) => 'email' in r);

  // What each ticked row can have done to it
  const isRejectable = (r) => r.status === 'pending' || (r.status === 'approved' && r.payment_status !== 'paid');
         const isOwnRow = (r) => !event.my.can_manage && r.user_id === user.id; // delegates cannot act on themselves
  const isSelectable = (r) => !isOwnRow(r) && (isRejectable(r) || (canComplete && r.status === 'confirmed'));

  const selectedRows = all.filter((r) => selected.includes(r.id));
  const toApprove = selectedRows.filter((r) => r.status === 'pending');
  const toReject = selectedRows.filter(isRejectable);
  const toComplete = selectedRows.filter((r) => r.status === 'confirmed' && !r.completed);
  const toUncomplete = selectedRows.filter((r) => r.status === 'confirmed' && r.completed);

  const visibleSelectable = rows.filter(isSelectable);
  const allVisibleTicked = visibleSelectable.length > 0 && visibleSelectable.every((r) => selected.includes(r.id));

  function toggleRow(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    const ids = visibleSelectable.map((r) => r.id);
    setSelected((prev) => (allVisibleTicked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  }

  async function act(request) {
    setBusy(true);
    setNotice('');
    setActionError('');
    try {
      const res = await request();
      setNotice(res.data.message);
      setSelected([]);
      reload();
      onChanged();
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const url = `/events/${event.id}/registrations`;
  const approve = () => act(() => api.post(`${url}/approve`, { registration_ids: toApprove.map((r) => r.id) }));
  const markComplete = (completed, list) =>
    act(() => api.post(`${url}/complete`, { registration_ids: list.map((r) => r.id), completed }));

  async function handleReject(e) {
    e.preventDefault();
    const ok = await act(() => api.post(`${url}/reject`, { registration_ids: toReject.map((r) => r.id), reason }));
    if (ok) {
      setShowReject(false);
      setReason('');
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap gap-4 mb-3 small">
        <span><strong>{data.seats_taken}</strong> of {data.capacity ?? 'unlimited'} seats taken</span>
        <span>{paidEvent ? `Fee ₹${data.fee}` : 'Free'}</span>
        <span>{data.auto_approve ? 'Approved automatically' : 'You approve each registration'}</span>
      </div>

      <Nav variant="pills" className="mb-3 gap-1" activeKey={activeFilter} onSelect={(key) => { setFilter(key); setSelected([]); }}>
        {FILTERS.map((f) => (
          <Nav.Item key={f}>
            <Nav.Link eventKey={f} className="py-1 px-3">
              {f === 'all' ? 'All' : REGISTRATION_LABELS[f]}{' '}
              <Badge bg="light" text="dark">{f === 'all' ? all.length : data.counts[f] ?? 0}</Badge>
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {(actionError || error) && <Alert variant="danger" className="py-2">{actionError || error}</Alert>}

      <Card>
        <Card.Header className="d-flex flex-wrap gap-2 align-items-center">
          <span className="small text-muted me-auto">{selected.length} selected</span>
          <Button size="sm" disabled={busy || toApprove.length === 0} onClick={approve}>
            Approve ({toApprove.length})
          </Button>
          <Button size="sm" variant="outline-danger" disabled={busy || toReject.length === 0} onClick={() => setShowReject(true)}>
            Reject ({toReject.length})
          </Button>
          {canComplete && (
            <>
              <Button size="sm" variant="outline-primary" disabled={busy || toComplete.length === 0} onClick={() => markComplete(true, toComplete)}>
                Mark complete ({toComplete.length})
              </Button>
              <Button size="sm" variant="link" disabled={busy || toUncomplete.length === 0} onClick={() => markComplete(false, toUncomplete)}>
                Unmark ({toUncomplete.length})
              </Button>
            </>
          )}
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th style={{ width: '2.5rem' }}>
                <Form.Check
                  aria-label="Select all shown"
                  checked={allVisibleTicked}
                  disabled={visibleSelectable.length === 0}
                  onChange={toggleAllVisible}
                />
              </th>
              <th>Participant</th>
              <th>Program</th>
              <th>Status</th>
              {paidEvent && <th>Payment</th>}
              <th>Registered</th>
              {showContact && <th>Contact</th>}
              {canComplete && <th>Completed</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">Nobody here.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {isSelectable(r) && (
                    <Form.Check aria-label={`Select ${r.name}`} checked={selected.includes(r.id)} onChange={() => toggleRow(r.id)} />
                  )}
                </td>
                                <td>
                  {r.name}
                  {isOwnRow(r) && <span className="soft-badge tone-muted ms-2">You</span>}
                  <div className="small text-muted">{r.roll_no || 'Faculty'}</div>
                </td>
                <td className="small">{r.program ? `${r.program} · Y${r.year}` : '—'} {r.department_code && `· ${r.department_code}`}</td>
                <td>
                  <span className={`soft-badge tone-${STATUS_TONES[r.status]}`}>{REGISTRATION_LABELS[r.status]}</span>
                  {r.rejection_reason && <div className="small text-muted mt-1">{r.rejection_reason}</div>}
                </td>
                {paidEvent && <td className="small">{r.payment_status === 'paid' ? 'Paid' : r.status === 'approved' ? 'Due' : '—'}</td>}
                <td className="small text-muted">{formatDateTime(r.registered_at)}</td>
                {showContact && (
                  <td className="small">
                    {r.email}
                    {r.phone && <div className="text-muted">{r.phone}</div>}
                  </td>
                )}
                {canComplete && <td>{r.completed ? '✓' : ''}</td>}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal show={showReject} onHide={() => setShowReject(false)} centered>
        <Form onSubmit={handleReject}>
          <Modal.Header closeButton>
            <Modal.Title as="h3" className="h5">Reject {toReject.length} registration{toReject.length === 1 ? '' : 's'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Label htmlFor="reject-reason">Reason (each student sees this)</Form.Label>
            <Form.Control
              id="reject-reason"
              as="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowReject(false)}>Back</Button>
            <Button type="submit" variant="danger" disabled={busy}>{busy ? 'Rejecting…' : 'Reject'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}